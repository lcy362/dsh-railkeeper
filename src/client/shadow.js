/**
 * dsh-railkeeper —— 遮蔽条目的推导（纯函数，不碰 React / DOM）。
 *
 * 左侧栏的 `sidebar.panellist` 是一个 list 槽位：按 id 定址，(id, priority) 唯一，
 * 同一 id 下 priority 最小者渲染。本插件要改顺序、改名称、换图标、隐藏，做法是
 * **注册自己的条目盖住原生条目**，而不是去改别人的条目对象。
 *
 * 为什么这条边界值得单独成文件：
 *
 * 早期实现直接改别人条目上的 order/label/component。槽位注册表里那些 options 是
 * 普通对象，改它不产生通知，于是当时靠「注册一个临时条目再立刻释放」推一帧。
 * 只要还有第二个插件在观察同一个槽位（插件市场就会给 `plugins` 套一层更新角标，
 * 且自己也在监听 `sidebar.panellist`），两边就会互相触发：我们改 → 它重注册 →
 * 槽位通知 → 我们再改……整条链都在微任务里，事件循环没有机会让出，界面卡死。
 *
 * 改成遮蔽之后，收敛靠两件事：
 *   1. **签名**：计划没变就一个条目都不重注册；
 *   2. **最小足迹**：用户没动过的面板根本不遮蔽，让别人（含插件市场的角标）照原样渲染。
 *
 * 这一层是纯函数，所以可以在 node 里直接跑「两个插件共存」的模拟，把「有界」
 * 这件事钉成断言。
 */

/** 本插件遮蔽条目的 priority 基准：永远比同 id 的其它注册者低一档。 */
export const SHADOW_PRIORITY_STEP = 1

/**
 * 某格「如果没有本插件时会渲染的组件」所在的原生条目。
 *
 * 取注册表顺序里的第一个：内核已按 priority、order 排好序，第一个就是原生赢家。
 * 这样插件市场套在 `plugins` 上的更新角标会被我们包在里面，角标不丢。
 *
 * @param {string} id
 * @param {Array<{ options: { id?: string, priority?: number } }>} natives
 */
export function sourceEntryFor(id, natives) {
  for (const entry of natives) {
    if (entry.options.id === id) return entry
  }
  return undefined
}

/**
 * 本插件遮蔽条目的 priority：比同 id 的其它注册者都低一档。
 *
 * 必须现算而不是写死：插件市场给 `plugins` 注册的是 -1，我们得比它更低；
 * 同时还要避开 (id, priority) 唯一这条约束——低一档天然不撞。
 *
 * @param {string} id
 * @param {Array<{ options: { id?: string, priority?: number } }>} natives
 */
export function shadowPriorityFor(id, natives) {
  let min = 0
  for (const entry of natives) {
    if (entry.options.id !== id) continue
    const priority = typeof entry.options.priority === 'number' ? entry.options.priority : 0
    if (priority < min) min = priority
  }
  return min - SHADOW_PRIORITY_STEP
}

/**
 * 一条遮蔽条目的签名。
 *
 * 只包含「重新注册才有意义」的维度：顺序、自定义名称、图标、是否隐藏。
 *
 * **刻意不含被包裹组件的身份**：包裹组件在渲染时才去解析「现在这一格的原生赢家
 * 是谁」，所以别人重注册、加装饰、撤装饰都不需要我们再动一次。早期把组件身份
 * 写进签名，等于把别人的每次重注册都变成我们的一次重注册，两边互相喂养——
 * 这正是「点合并卡死」那条无界微任务链的一半来源。
 *
 * @param {{
 *   order: number,
 *   label?: string,
 *   icon?: string | null,
 *   hidden: boolean,
 * }} state
 */
export function shadowSignature(state) {
  return [
    state.order,
    typeof state.label === 'string' ? state.label : '',
    typeof state.icon === 'string' ? state.icon : '',
    state.hidden ? 1 : 0,
  ].join('|')
}

/**
 * 原生条目的相对顺序（按 order、再按注册顺序）。
 *
 * 同一 id 可能有多条（例如插件市场给 `plugins` 套的角标层）：注册表已按
 * priority 排好序，第一条就是真正渲染的那个，后面的要丢掉——否则同一个面板
 * 会被数成两行，顺序比较也永远判成「变了」。
 * @param {Array<{ options: { id?: string, order?: number } }>} natives
 */
function nativeOrder(natives) {
  const seen = new Set()
  return natives
    .map((entry, index) => ({
      id: entry.options.id,
      order: typeof entry.options.order === 'number' ? entry.options.order : index,
      index,
    }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .filter((item) => {
      if (typeof item.id !== 'string' || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
    .map((item) => item.id)
}

/**
 * 顶层面板在计划里的相对顺序（分组行不算：那是我们自己的条目）。
 * @param {{ rows: Array<{ kind: string, id: string }> }} plan
 */
function planOrder(plan) {
  return plan.rows.filter((row) => row.kind === 'panel').map((row) => row.id)
}

/**
 * 顺序是否需要改写：只比较两边都有的 id，别人临时多出来的不参与。
 * @param {string[]} a
 * @param {string[]} b
 */
function sameOrder(a, b) {
  const left = a.filter((id) => b.includes(id))
  const right = b.filter((id) => a.includes(id))
  return left.length === right.length && left.every((id, index) => id === right[index])
}

/**
 * 由计划推导出「这一帧应该有哪些遮蔽条目」。
 *
 * 最小足迹：只有用户真的动过的面板才遮蔽——
 *   - 改过名称 / 图标；
 *   - 被隐藏，或进了分组（成员行不画）；
 *   - 顺序与原生顺序不一致（用户拖过、合并过）。
 * 其它面板一个条目都不注册，交回原生注册者渲染，插件市场之类的装饰因此照常生效。
 *
 * @param {{ rows: Array<{ kind: string, id: string }>, panels: Map<string, { id: string, order: number, hidden: boolean, grouped: boolean, icon: string | null }> }} plan
 * @param {Record<string, { label?: string, icon?: string, hidden?: boolean }> | undefined} overrides 配置里的 `panels` 覆盖项
 * @param {Array<{ options: { id?: string, priority?: number, order?: number }, component?: unknown }>} natives 其它插件的条目
 * @returns {Map<string, { id: string, order: number, priority: number, label: string, signature: string }>}
 */
export function planShadows(plan, overrides, natives) {
  const wanted = new Map()
  const orderChanged = !sameOrder(planOrder(plan), nativeOrder(natives))
  for (const [id, state] of plan.panels) {
    const source = sourceEntryFor(id, natives)
    if (source === undefined) continue
    const override = overrides?.[id]
    const customLabel = typeof override?.label === 'string' && override.label.length > 0 ? override.label : ''
    const hidden = state.hidden || state.grouped
    const touched = customLabel.length > 0
      || (typeof state.icon === 'string' && state.icon.length > 0)
      || hidden
      || orderChanged
    if (!touched) continue
    wanted.set(id, {
      id,
      order: state.order,
      priority: shadowPriorityFor(id, natives),
      label: customLabel,
      signature: shadowSignature({ order: state.order, label: customLabel, icon: state.icon, hidden }),
    })
  }
  return wanted
}

/**
 * 对比「现在挂着什么」与「这一帧该有什么」，给出最小操作集。
 *
 * @param {Map<string, { signature: string }>} current 已注册的遮蔽条目
 * @param {Map<string, { signature: string }>} wanted 计划要求的
 * @returns {{ dispose: string[], register: string[] }}
 */
export function diffShadows(current, wanted) {
  const dispose = []
  const register = []
  for (const id of current.keys()) {
    if (!wanted.has(id)) dispose.push(id)
  }
  for (const [id, next] of wanted) {
    const existing = current.get(id)
    if (existing === undefined) {
      register.push(id)
      continue
    }
    if (existing.signature !== next.signature) {
      // 签名变了：先摘旧的再注册同一 id，避免 (id, priority) 撞车。
      dispose.push(id)
      register.push(id)
    }
  }
  return { dispose, register }
}