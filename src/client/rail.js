/**
 * dsh-railkeeper —— 左侧栏运行时。
 *
 * 做的事：
 * 1. 读 `sidebar.panellist` 的注册表，记下每个面板的原始 order/label/component；
 * 2. 按配置改写 order、label、图标组件，并把“隐藏/已分组”写成一个标记节点；
 * 3. 分组行：额外注册一条 `sidebar.panellist` 条目 + 同 key 的 `main` 页面；
 * 4. 用一段由本插件拥有的样式把带标记的整行隐藏。
 *
 * 为什么要“nudge”：注册表条目上的 options 是普通对象，改它不会通知订阅者。
 * 注册一个临时条目再立刻释放，可以把一次批量通知推进微任务队列，让侧栏
 * 重新读取 entriesOfSlot。这个做法与 dsh-panellist 相同，属于内核当前实现
 * 的内部接缝；若未来失效，隐藏会退化为“不生效”，但不会影响面板加载。
 */
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { GROUP_ENTRY_PREFIX, RAIL_ENTRY_PREFIX } from '../shared/config.js'
import { Glyph } from './icons.js'
import { placeMenu } from './menu.js'
import { buildPlan } from './model.js'

const h = React.createElement
const STYLE_ID = 'dsh-railkeeper-styles'
const RAIL_ATTR = 'data-rk-rail'

/**
 * 把弹出菜单挂到 body 上的函数。
 *
 * 平台 seed 给的是哪个形状（CJS 对象、还是带 default 的 ESM 命名空间）不由我们
 * 决定，所以两种都认。都拿不到就退化为就地渲染——可能被侧栏的滚动容器裁掉，
 * 但绝不会因为一个未定义的函数把整个图标条目打崩。
 */
function resolvePortal(namespace) {
  if (typeof namespace?.createPortal === 'function') return namespace.createPortal
  if (typeof namespace?.default?.createPortal === 'function') return namespace.default.createPortal
  return null
}
const PORTAL = resolvePortal(ReactDOM)

/**
 * 所有权标记，挂在注册表条目对象上。
 *
 * 一轮 apply 就是一个「代」。HMR 重载或插件重载时，旧代的 dispose 可能在新代
 * 重建之后才跑；只比“字段值是否等于我写下的值”挡不住这种情况——两代会写下
 * 完全相同的值。所以这里比的是身份：谁最后认领了这个条目，谁才有回滚权。
 */
const ENTRY_OWNER = Symbol.for('dsh-railkeeper.owner')

const CSS = `
[${RAIL_ATTR}] > *:has([data-rk-hidden]) { display: none !important; }
[${RAIL_ATTR}] button:has([data-rk-group-active]) {
  background-color: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
/* 分组页只有在「更多」菜单里点进来时才会看到；样式对齐官方入口页
   （标题 20/500、说明 13 号次级色、顶部让出窗口色条），不要自成一套。 */
.rk-page {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 0 24px 48px;
  color: var(--dsw-alias-label-primary);
}
.rk-page-inner { max-width: 960px; margin: 0 auto; }
.rk-page-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  padding-top: var(--rk-page-top-inset, 24px);
}
[data-platform='darwin'] .rk-page-head { padding-top: calc(var(--rk-page-top-inset, 24px) + var(--dsh-frame-top-clearance, 0px)); }
.rk-page-heading { min-width: 0; }
.rk-page h1 { margin: 0; font-size: 20px; line-height: 28px; font-weight: 500; }
.rk-page-sub { margin: 4px 0 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.rk-page-body { margin-top: 20px; }
.rk-flyout {
  position: fixed;
  z-index: 90;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 176px;
  max-width: 288px;
  padding: 4px;
  box-sizing: border-box;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-separator-primary);
  box-shadow: var(--dsw-elevation-prominent, 0 8px 24px rgba(0, 0, 0, .18));
}
.rk-flyout-title {
  padding: 4px 8px 6px;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-caption);
}
.rk-flyout-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 5px 8px;
  box-sizing: border-box;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.rk-flyout-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
.rk-flyout-item[aria-current='page'] { background: var(--dsw-specific-sidebar-nav-item-active, var(--dsw-alias-interactive-bg-hover)); }
.rk-flyout-item[disabled] { cursor: default; opacity: .5; }
.rk-flyout-item[disabled]:hover { background: transparent; }
.rk-flyout-glyph { display: inline-flex; flex: none; }
.rk-flyout-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
.rk-card {
  display: flex; align-items: center; gap: 10px;
  min-height: 48px; padding: 8px 12px; box-sizing: border-box;
  border: 1px solid var(--dsw-alias-separator-primary);
  border-radius: var(--dsw-radius-md);
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px; text-align: left; cursor: pointer;
}
.rk-card:hover { background: var(--dsw-alias-interactive-bg-hover); }
.rk-card[disabled] { cursor: default; opacity: .55; }
.rk-card[disabled]:hover { background: transparent; }
.rk-card-icon { display: inline-flex; flex: none; }
.rk-card-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rk-empty { margin: 24px 0; color: var(--dsw-alias-label-secondary); font-size: 13px; }
`

/** @param {unknown} ctx */
function safeGet(ctx, name) {
  try {
    return ctx.get(name)
  } catch {
    return undefined
  }
}

/**
 * 解析可能为函数或字符串的 slot label。
 * @param {unknown} label
 */
function resolveLabel(label) {
  if (typeof label === 'function') {
    try {
      const value = label()
      return typeof value === 'string' ? value : undefined
    } catch {
      return undefined
    }
  }
  return typeof label === 'string' ? label : undefined
}

/**
 * 创建轨道控制器。
 * @param {{
 *   ctx: any,
 *   store: any（createConfigStore 的返回值）,
 *   i18n: any（createI18n 的返回值）,
 *   api: any（createApi 的返回值）,
 *   version: string,
 * }} options
 */
export function createRailController({ ctx, store, i18n, api, version }) {
  let started = false
  let disposed = false
  let slotReady = false
  let applying = false
  let scheduled = false
  let snapshotVersion = 0
  /** 检测到其它改写方后停止改写顺序/名称/图标，避免双方无限对写。 */
  let paused = false
  let lastReportAt = 0
  /**
   * 本插件最后一次写给每个面板的 order。
   *
   * 直接记“写下了什么”，而不是“某一轮快照读了什么”——快照会过期，
   * 而这份账本只在真正写入时才更新，永远和我们的意图一致。
   * @type {Map<string, string>}
   */
  const lastWrote = new Map()
  /**
   * 与另一个「也在管左侧栏」的插件冲突的证据。
   *
   * 本插件改的是注册表条目上的 order/label/component。另一个同类插件会把这些
   * 值改回它自己想要的样子；两边都在监听槽位变化，于是形成一个无限来回。
   * 检测方式很简单：写完之后过一帧再读，理应还是我们写的值。
   *
   * 连续撞到 3 次就停手并如实报告，绝不和对方对着写——用户看到的应该是
   * 一条「有别的插件在抢」的提示，而不是一个发热的循环。
   */
  let conflict = null
  let conflictStrikes = 0
  /** 当前展开的分组弹出菜单（null = 没有）。 */
  let openGroup = null
  /** 累计打开次数：判断「点击有没有被接管」比 flyoutOpen 可靠，后者会被关掉。 */
  let flyoutOpens = 0
  /** 菜单没能挂上、退回分组页的次数（正常情况下永远是 0）。 */
  let flyoutFallbacks = 0
  /** 菜单项的点击次数：证明点击有没有进到菜单的 onClick。 */
  let menuItemClicks = 0
  /** selectPanel 最近几次的结局（ok / not-in-main / threw …）。 */
  const selectNotes = []
  /** layout 服务的获取过程记录。 */
  const layoutNotes = []
  /** 自检结果：直接走一遍 selectPanel，把选中项读回来。 */
  let selectProbe = null
  /** 自检结果：程序化打开菜单并派发一次真实点击，看事件有没有到 onClick。 */
  let clickProbe = null
  /** 自检期间为真：菜单不可见、不抢焦点，但事件路径与生产完全一致。 */
  let quietProbe = false
  /** 正规取到的 layout 服务（ctx.inject('layout')）。 */
  let layoutService = null
  /** 弹出菜单的定位信息；null 表示还没量到触发元素。 */
  let openAnchor = null
  /** @type {null | (() => void)} */
  let flyoutCleanup = null
  /** @type {ReturnType<typeof buildPlan>} */
  let plan = buildPlan(store.getSnapshot().config, [])
  /** @type {Map<string, { entry: any, order: unknown, label: unknown, component: any }>} */
  const originals = new Map()
  /** @type {Map<string, any>} */
  const wrappers = new Map()
  /** @type {Map<string, any>} */
  const labelThunks = new Map()
  /** @type {Map<string, string>} */
  const groupSignatures = new Map()
  /** @type {Map<string, Array<() => void>>} */
  const groupDisposers = new Map()
  const listeners = new Set()
  /** @type {HTMLStyleElement | null} */
  let styleElement = null
  /** @type {Element | null} */
  let railElement = null
  /** @type {null | (() => void)} */
  let unsubscribeStore = null
  /** @type {null | (() => void)} */
  let unsubscribeSlot = null
  /** @type {null | (() => void)} */
  let unsubscribeDeclared = null
  /** @type {null | (() => void)} */
  let externalReloadCleanup = null
  /**
   * 本代的所有权凭证：每次创建 controller 都是一个新的对象。
   * 用对象身份而不是数字，因为 `Symbol.for` 是跨模块实例共享的，而
   * HMR 每次都会重新求值整个 bundle——数字会在新实例里从 0 重来。
   */
  const owner = {}

  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        // ignore
      }
    }
  }

  function ensureStyle() {
    if (typeof document === 'undefined') return
    if (styleElement !== null && styleElement.isConnected) return
    const existing = document.getElementById(STYLE_ID)
    if (existing instanceof HTMLStyleElement) {
      styleElement = existing
      return
    }
    const element = document.createElement('style')
    element.id = STYLE_ID
    element.textContent = CSS
    document.head.appendChild(element)
    styleElement = element
  }

  /** 从行内标记找到侧栏 nav 并打上本插件属性。 */
  function tagRail(node) {
    ensureStyle()
    const element = node instanceof Element ? node : null
    const nav = element?.closest('nav') ?? null
    if (nav === null) return
    railElement = nav
    if (!nav.hasAttribute(RAIL_ATTR)) nav.setAttribute(RAIL_ATTR, '')
  }

  /** 当前注册表里由其它插件注册的面板条目。 */
  function realEntries() {
    let entries = []
    try {
      entries = ctx.slots.entriesOfSlot('sidebar.panellist')
    } catch {
      return []
    }
    return entries.filter((entry) => {
      const id = entry?.options?.id
      return typeof id === 'string' && !id.startsWith(RAIL_ENTRY_PREFIX)
    })
  }

  /**
   * 把条目投影成 live 面板列表（按 order、再按注册顺序）。
   * @param {any[]} entries
   */
  function livePanels(entries) {
    return entries
      .map((entry, index) => ({
        id: entry.options.id,
        order: typeof entry.options.order === 'number' ? entry.options.order : index,
        label: resolveLabel(entry.options.label) ?? entry.options.id,
        index,
      }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map(({ id, order, label }) => ({ id, order, label }))
  }

  /**
   * 记录原始值；条目被重新注册时刷新记录。
   * @param {any[]} entries
   */
  function captureOriginals(entries) {
    const seen = new Set()
    for (const entry of entries) {
      const id = entry.options.id
      seen.add(id)
      const previous = originals.get(id)
      if (previous === undefined || previous.entry !== entry) {
        // `touched` 记录本代写进去的值：卸载时只回滚「仍然是本代写下的」字段。
        // 否则一个已经被替换掉的旧代会在新代生效后把值改回原始值（HMR / 重载竞态）。
        originals.set(id, {
          entry,
          order: entry.options.order,
          label: entry.options.label,
          component: entry.component,
          touched: {},
        })
        wrappers.delete(id)
      }
    }
    for (const id of [...originals.keys()]) {
      if (!seen.has(id)) {
        originals.delete(id)
        wrappers.delete(id)
        labelThunks.delete(id)
      }
    }
  }

  /** @param {string} id */
  function stableLabelThunk(id) {
    let thunk = labelThunks.get(id)
    if (thunk === undefined) {
      thunk = () => {
        const config = store.getSnapshot().config
        const custom = config.panels?.[id]?.label
        if (typeof custom === 'string' && custom.length > 0) return custom
        const original = originals.get(id)?.label
        return resolveLabel(original) ?? id
      }
      labelThunks.set(id, thunk)
    }
    return thunk
  }

  /**
   * 生成一个面板图标包裹组件：标记 + 自定义图标或原始图标。
   * @param {string} id
   * @param {any} Original
   */
  function makeWrapper(id, Original) {
    return function RailkeeperIcon(props) {
      React.useSyncExternalStore(subscribe, getVersion, getVersion)
      const state = plan.panels.get(id)
      const hidden = state !== undefined && (state.hidden || state.grouped) && props.active !== true
      const marker = h('span', {
        ref: tagRail,
        ...(hidden ? { 'data-rk-hidden': '' } : {}),
      })
      if (hidden) return marker
      if (state !== undefined && typeof state.icon === 'string' && state.icon.length > 0) {
        return h(React.Fragment, null, marker, h(Glyph, { name: state.icon, size: props.size, active: props.active }))
      }
      return h(React.Fragment, null, marker, Original === undefined || Original === null ? null : h(Original, props))
    }
  }

  /** 给侧栏发一次通知（见文件头说明）。 */
  function nudge() {
    if (!slotReady) return
    try {
      const dispose = ctx.slots.register({
        name: 'sidebar.panellist',
        id: `${RAIL_ENTRY_PREFIX}nudge`,
        order: 99_999,
      }, () => null)
      dispose()
    } catch {
      // 内核对注册/释放的顺序有保护；失败只意味着这一帧不重排。
    }
  }

  /**
   * 冲突暂停期间的降级路径：只挂/摘图标包裹组件（它承载「隐藏」标记），
   * 不碰 order 与 label。
   * @param {any} entry
   * @param {any} state
   * @param {any} original
   */
  function applyWrapperOnly(entry, state, original) {
    const id = entry.options.id
    const needsWrapper = state.hidden || state.grouped || typeof state.icon === 'string'
    if (needsWrapper) {
      let wrapper = wrappers.get(id)
      if (wrapper === undefined) {
        wrapper = makeWrapper(id, original.component)
        wrappers.set(id, wrapper)
      }
      if (entry.component !== wrapper) {
        entry.component = wrapper
        original.touched.component = wrapper
        return true
      }
      return false
    }
    if (entry.component !== original.component) {
      entry.component = original.component
      delete original.touched.component
      return true
    }
    return false
  }

  /**
   * 改写一个面板条目到计划状态。
   * @param {any} entry
   * @param {ReturnType<typeof buildPlan>} nextPlan
   */
  function applyEntry(entry, nextPlan) {
    const id = entry.options.id
    const state = nextPlan.panels.get(id)
    if (state === undefined) return false
    let mutated = false
    const original = originals.get(id)
    if (original === undefined) return false
    if (paused) {
      // 只保留组件包裹（隐藏标记是我们自己的），顺序/名称/图标一律不再争。
      return applyWrapperOnly(entry, state, original)
    }
    if (entry[ENTRY_OWNER] !== owner) entry[ENTRY_OWNER] = owner
    if (entry.options.order !== state.order) {
      entry.options.order = state.order
      original.touched.order = state.order
      mutated = true
    }
    lastWrote.set(id, String(state.order))
    const override = store.getSnapshot().config.panels?.[id]
    const customLabel = typeof override?.label === 'string' && override.label.length > 0
    if (customLabel) {
      const thunk = stableLabelThunk(id)
      if (entry.options.label !== thunk) {
        entry.options.label = thunk
        original.touched.label = thunk
        mutated = true
      }
    } else if (entry.options.label !== original.label) {
      if (original.label === undefined) delete entry.options.label
      else entry.options.label = original.label
      delete original.touched.label
      mutated = true
    }
    const needsWrapper = state.hidden || state.grouped || typeof state.icon === 'string'
    if (needsWrapper) {
      let wrapper = wrappers.get(id)
      if (wrapper === undefined) {
        wrapper = makeWrapper(id, original?.component)
        wrappers.set(id, wrapper)
      }
      if (entry.component !== wrapper) {
        entry.component = wrapper
        original.touched.component = wrapper
        mutated = true
      }
    } else if (entry.component !== original.component) {
      entry.component = original.component
      delete original.touched.component
      mutated = true
    }
    return mutated
  }

  /** @param {string} groupId */
  function groupLabel(groupId) {
    const group = plan.groups.get(groupId)
    const label = typeof group?.label === 'string' ? group.label : ''
    return label.length > 0 ? label : i18n.t('group.defaultName')
  }

  /** 释放一个分组已注册的侧栏行与主区域页面。 */
  function disposeGroup(groupId) {
    const disposers = groupDisposers.get(groupId)
    if (disposers !== undefined) {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          // ignore
        }
      }
    }
    groupDisposers.delete(groupId)
    groupSignatures.delete(groupId)
  }

  /** 注册（或刷新）分组行。 */
  function syncGroups(nextPlan) {
    const wanted = new Set(nextPlan.groups.keys())
    for (const groupId of [...groupDisposers.keys()]) {
      if (!wanted.has(groupId)) disposeGroup(groupId)
    }

    for (const [groupId, group] of nextPlan.groups) {
      const signature = `${group.order}|${group.label}|${group.icon ?? ''}|${group.hidden ? 1 : 0}`
      if (groupSignatures.get(groupId) === signature) continue
      // 先释放旧注册，再注册同一 id，避免 list slot 的重复 id 冲突。
      disposeGroup(groupId)
      const railId = `${GROUP_ENTRY_PREFIX}${groupId}`
      let disposeRail
      try {
        disposeRail = ctx.slots.register({
          name: 'sidebar.panellist',
          id: railId,
          order: group.order,
          label: () => groupLabel(groupId),
        }, makeGroupIcon(groupId))
      } catch {
        continue
      }
      let disposeMain = () => {}
      try {
        disposeMain = ctx.slots.register({ name: 'main', key: railId }, makeGroupPage(groupId))
      } catch {
        try {
          disposeMain = ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: railId }, makeGroupPage(groupId)))
        } catch {
          disposeMain = () => {}
        }
      }
      groupSignatures.set(groupId, signature)
      groupDisposers.set(groupId, [disposeRail, disposeMain])
    }
  }

  /**
   * 分组行的 ref。
   *
   * 分组身份必须打在**整行按钮**上，不能只打在行内的图标节点上：用户可能点在
   * 图标右侧的文字或留白上，那种情况下从事件目标往上找是找不到图标节点的。
   * 打在按钮上，`closest()` 才能覆盖整行；而「取消固定」是按钮的兄弟节点，
   * 不会被误判成整行点击。
   * @param {string} groupId
   */
  function groupRowRef(groupId) {
    return (node) => {
      tagRail(node)
      if (node === null) return
      const button = node.closest('button')
      if (button !== null) button.setAttribute('data-rk-group-row', groupId)
    }
  }

  /**
   * 分组行图标：成员被选中时高亮整行，点击时弹出成员菜单。
   *
   * 为什么不是“点开一整页”：分组在用户的心里仍然是侧栏上的一行，点它应该当场
   * 展开成员，而不是把人从当前会话里带走。真正的点击由文档捕获阶段的监听器接管
   * （见 handleCaptureClick），这里只负责画出这一行和那个弹出菜单。
   */
  function makeGroupIcon(groupId) {
    return function GroupRailIcon(props) {
      React.useSyncExternalStore(subscribe, getVersion, getVersion)
      const activePanelId = useActiveId()
      const group = plan.groups.get(groupId)
      if (group === undefined) return null
      const memberActive = activePanelId !== null && group.members.includes(activePanelId)
      const marker = h('span', {
        ref: groupRowRef(groupId),
        ...(group.hidden ? { 'data-rk-hidden': '' } : {}),
        ...(memberActive ? { 'data-rk-group-active': '' } : {}),
      })
      if (group.hidden) return marker
      return h(
        React.Fragment,
        null,
        marker,
        h(Glyph, { name: group.icon ?? 'layers', size: props.size, active: memberActive }),
        openGroup === groupId ? h(GroupFlyout, { groupId, activePanelId }) : null,
      )
    }
  }

  /**
   * 分组成员菜单。挂在 body 上（`position: fixed`），因此不会被侧栏的
   * overflow 裁掉；位置由 placeMenu 按触发元素与视口算出。
   */
  function GroupFlyout({ groupId, activePanelId }) {
    const group = plan.groups.get(groupId)
    const ref = React.useRef(null)
    const [spot, setSpot] = React.useState(null)
    React.useLayoutEffect(() => {
      const node = ref.current
      if (node === null) return
      // 先量菜单自身，再量视口，最后交给纯函数算坐标：菜单能多大只有此刻才知道。
      const box = node.getBoundingClientRect()
      const viewport = {
        width: window.innerWidth || 1024,
        height: window.innerHeight || 768,
      }
      const anchor = openAnchor
      const placed = anchor === null
        ? { top: 8, left: 8 }
        : placeMenu(anchor, { width: box.width, height: box.height }, viewport)
      setSpot({ top: placed.top, left: placed.left })
      if (quietProbe) return
      const first = node.querySelector('button:not([disabled])')
      try {
        ;(first ?? node).focus({ preventScroll: true })
      } catch {
        // 焦点失败不影响菜单可用
      }
    }, [])
    if (group === undefined) return null
    const menu = h(
      'div',
      {
        ref,
        className: 'rk-flyout',
        role: 'menu',
        tabIndex: -1,
        'aria-label': groupLabel(groupId),
        // 关键：portal 只改变 DOM 位置，React 树里的位置没变——菜单在 React 树里
        // 仍然是侧栏那一行按钮的后代，合成事件会沿 React 树冒泡到那一行的
        // onClick（selectPanel 分组 id），把刚选中的成员当场覆盖掉。
        // 在菜单这一层截断，菜单内部的任何点击都不会再传出去。
        onClick: (event) => {
          event.stopPropagation()
        },
        style: spot === null
          ? { top: 0, left: 0, visibility: 'hidden' }
          : quietProbe
            // 自检期间：菜单照常渲染、照常接收事件，只是不画出来、不抢焦点，
            // 这样自动自检不会在启动后闪一下菜单。
            ? { top: spot.top, left: spot.left, visibility: 'hidden', pointerEvents: 'none' }
            : { top: spot.top, left: spot.left },
      },
      h('div', { className: 'rk-flyout-title' }, groupLabel(groupId)),
      group.members.map((memberId) => {
        const state = plan.panels.get(memberId)
        const canOpen = canSelectPanel(memberId)
        return h(
          'button',
          {
            key: memberId,
            type: 'button',
            role: 'menuitem',
            className: 'rk-flyout-item',
            disabled: !canOpen,
            'aria-current': activePanelId === memberId ? 'page' : undefined,
            onClick: (event) => {
              // 双保险：菜单容器已经截断，这里再拦一次，将来重构也不会退化
              event.stopPropagation()
              menuItemClicks += 1
              closeFlyout()
              selectPanel(memberId)
              // 这一次上报要看的是「点完之后选中项变成了谁」，必须绕过节流
              report(true)
            },
          },
          h('span', { className: 'rk-flyout-glyph' }, h(PanelIconView, { id: memberId, size: 16 })),
          h('span', { className: 'rk-flyout-label' }, state?.label ?? memberId),
        )
      }),
    )
    return PORTAL === null ? menu : PORTAL(menu, document.body)
  }

  /**
   * 打开分组的弹出菜单。
   * 触发元素就是分组行里的标记节点，它对应用户实际点的那一行。
   * @param {string} groupId
   * @param {Element | null} marker
   */
  function openFlyout(groupId, row) {
    const box = row?.getBoundingClientRect?.()
    openGroup = groupId
    openAnchor = box === undefined || box === null
      ? null
      : { top: box.top, left: box.left, width: box.width, height: box.height }
    // 这里只记锚点；菜单的真实尺寸要等它渲染出来才量得到（见 GroupFlyout）。
    flyoutOpens += 1
    bumpAndNotify()
    report(true)
    // 安全网：点击已经被我们拦下了，如果菜单因为任何原因没能挂上，这一行就成了
    // 「点了没反应」。宁可回退到分组页，也不要留给用户一个死按钮。
    setTimeout(() => {
      if (disposed || openGroup !== groupId) return
      if (typeof document === 'undefined' || document.querySelector('.rk-flyout') !== null) return
      flyoutFallbacks += 1
      closeFlyout()
      selectPanel(`${GROUP_ENTRY_PREFIX}${groupId}`)
    }, 150)
  }

  /**
   * 状态变了就一定要把版本号推进一格。
   *
   * 组件的订阅用的是 `useSyncExternalStore(subscribe, getVersion, getVersion)`：
   * 它拿 getVersion 的返回值做「快照有没有变」的判断。只喊 notify() 不推版本号，
   * React 会认为快照没变而跳过重渲染——菜单于是根本不出现，而点击又已经被我们
   * 拦下了，用户看到的就是「点了没反应」。
   */
  function bumpAndNotify() {
    snapshotVersion += 1
    notify()
  }

  /** 关闭分组菜单，并把焦点还给触发它的那一行。 */
  function closeFlyout() {
    if (openGroup === null) return
    const row = typeof document === 'undefined' || quietProbe
      ? null
      : document.querySelector(`[data-rk-group-row="${openGroup}"]`)
    openGroup = null
    openAnchor = null
    bumpAndNotify()
    if (row !== null) {
      try {
        row.focus({ preventScroll: true })
      } catch {
        // 焦点归还失败不影响功能
      }
    }
  }

  /**
   * 捕获阶段的点击处理。
   *
   * 侧栏的每一行默认会调 layout.selectPanel。分组行没有对应的主区域页面，
   * 所以必须在 React 的 onClick 之前把事件截住（捕获阶段 + stopPropagation），
   * 换成弹出菜单——否则要么跳走一页，要么抛「面板未注册」。
   * @param {MouseEvent} event
   */
  function handleCaptureClick(event) {
    const target = event.target
    if (!(target instanceof Element)) return
    const row = target.closest('[data-rk-group-row]')
    if (row !== null) {
      event.preventDefault()
      event.stopPropagation()
      const groupId = row.getAttribute('data-rk-group-row')
      if (groupId === null) return
      if (openGroup === groupId) closeFlyout()
      else openFlyout(groupId, row)
      return
    }
    if (openGroup === null) return
    // 点菜单外面就关掉；点菜单里面交给菜单自己的 onClick。
    if (target.closest('.rk-flyout') !== null) return
    closeFlyout()
  }

  /** @param {KeyboardEvent} event */
  function handleCaptureKeydown(event) {
    if (openGroup === null) return
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    closeFlyout()
  }

  /** 装上全局的捕获监听；卸载时一并摘掉。 */
  function installFlyoutListeners() {
    if (typeof document === 'undefined') return
    document.addEventListener('click', handleCaptureClick, true)
    document.addEventListener('keydown', handleCaptureKeydown, true)
    document.addEventListener('wheel', handleCaptureWheel, true)
    flyoutCleanup = () => {
      document.removeEventListener('click', handleCaptureClick, true)
      document.removeEventListener('keydown', handleCaptureKeydown, true)
      document.removeEventListener('wheel', handleCaptureWheel, true)
    }
  }

  /**
   * 侧栏滚动时菜单会跟丢锚点，直接关掉比让它飘在原地诚实。
   * @param {Event} event
   */
  function handleCaptureWheel(event) {
    if (openGroup === null) return
    const target = event.target
    if (target instanceof Element && target.closest('.rk-flyout') !== null) return
    closeFlyout()
  }

  /** 主区域的分组页。 */
  function makeGroupPage(groupId) {
    return function GroupPage() {
      React.useSyncExternalStore(subscribe, getVersion, getVersion)
      const activePanelId = useActiveId()
      const group = plan.groups.get(groupId)
      if (group === undefined) return null
      const title = groupLabel(groupId)
      return h(
        'div',
        { className: 'rk-page' },
        h(
          'div',
          { className: 'rk-page-inner' },
          h(
            'div',
            { className: 'rk-page-head' },
            h(
              'div',
              { className: 'rk-page-heading' },
              h('h1', null, title),
              h('p', { className: 'rk-page-sub' }, i18n.t('page.groupIntro', { members: group.members.length })),
            ),
          ),
          group.members.length === 0
            ? h('p', { className: 'rk-empty' }, i18n.t('group.empty'))
            : h(
              'div',
              { className: 'rk-grid rk-page-body' },
              group.members.map((memberId) => {
                const state = plan.panels.get(memberId)
                const canOpen = canSelectPanel(memberId)
                return h(
                  'button',
                  {
                    key: memberId,
                    type: 'button',
                    className: 'rk-card',
                    disabled: !canOpen,
                    'aria-current': activePanelId === memberId ? 'page' : undefined,
                    onClick: () => selectPanel(memberId),
                    title: canOpen ? undefined : i18n.t('row.missing'),
                  },
                  h('span', { className: 'rk-card-icon' }, h(PanelIconView, { id: memberId, size: 18 })),
                  h('span', { className: 'rk-card-label' }, state?.label ?? memberId),
                )
              }),
            ),
        ),
      )
    }
  }

  /** 读取某个面板的图标（自定义优先，否则原始组件）。 */
  function PanelIconView({ id, size }) {
    React.useSyncExternalStore(subscribe, getVersion, getVersion)
    const state = plan.panels.get(id)
    if (state !== undefined && typeof state.icon === 'string' && state.icon.length > 0) {
      return h(Glyph, { name: state.icon, size })
    }
    const Original = originals.get(id)?.component
    if (Original === undefined || Original === null) return h(Glyph, { name: 'grid', size })
    return h(Original, { size, active: false })
  }

  /** @param {string} id */
  function canSelectPanel(id) {
    try {
      return ctx.slots.entriesOfSlot('main').some((entry) => entry.options.key === id)
    } catch {
      return false
    }
  }

  /**
   * 切到某个面板。
   *
   * 每一条早退路径都记一笔：这里的失败在界面上只表现为「点了没反应」，
   * 没有记录就只能靠猜。
   * @param {string} id
   */
  function selectPanel(id) {
    const note = (outcome) => {
      selectNotes.unshift(`${id}:${outcome}`)
      if (selectNotes.length > 8) selectNotes.length = 8
    }
    const layout = layoutOf()
    if (layout === null) {
      note('no-layout')
      return
    }
    let canCall = false
    try {
      canCall = typeof layout.selectPanel === 'function'
    } catch (error) {
      note(`layout-threw:${error instanceof Error ? error.message : String(error)}`)
      return
    }
    if (!canCall) {
      note('no-selectPanel')
      return
    }
    if (!canSelectPanel(id)) {
      note('not-in-main')
      return
    }
    try {
      layout.selectPanel(id)
      note('ok')
    } catch (error) {
      note(`throw:${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /** 取当前 layout 实例：优先用 inject 声明的那个，退化时才用 ctx.get。 */
  function layoutOf() {
    if (layoutService !== null) return layoutService
    const fallback = safeGet(ctx, 'layout')
    return fallback === undefined ? null : fallback
  }

  function activeId() {
    try {
      return layoutOf()?.panelInfo?.getSnapshot()?.activePanelId ?? null
    } catch {
      return null
    }
  }

  function subscribeActive(listener) {
    const panelInfo = layoutOf()?.panelInfo
    if (panelInfo === undefined || typeof panelInfo.subscribe !== 'function') return () => {}
    try {
      return panelInfo.subscribe(listener)
    } catch {
      return () => {}
    }
  }

  function useActiveId() {
    return React.useSyncExternalStore(subscribeActive, activeId, activeId)
  }

  function getVersion() {
    return snapshotVersion
  }

  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  /** 上报一次现场（诊断用，失败静默）。 */
  /**
   * 排一次「渲染落定后」的上报。
   *
   * rebuild() 改写注册表只是把通知排进队列，React 还没提交；此刻量 DOM 只能
   * 量到上一帧。等一帧后再量，数出来的才是用户真正看到的东西。
   */
  function reportSoon() {
    // 用定时器而不是 requestAnimationFrame：窗口在后台时 rAF 会被暂停，
    // 而这条上报要的只是「渲染大概率已落定」。诊断路径，不追求帧精度。
    setTimeout(() => report(), 160)
  }

  function report(force = false) {
    const now = Date.now()
    if (!force && now - lastReportAt < 1500) return
    lastReportAt = now
    let rail = railElement
    if (rail === null || !rail.isConnected) {
      try {
        rail = document.querySelector(`[${RAIL_ATTR}]`) ?? document.querySelector('[data-sidebar-scrollport] nav')
      } catch {
        rail = null
      }
    }
    if (rail !== null) tagRail(rail)
    // 真实 DOM 事实：行数、真正被画出来的行数、每行标签。
    // 用 getClientRects 而不是属性计数，才能证明“隐藏真的生效了”。
    const children = rail === null ? [] : [...rail.children]
    const visible = children.filter((node) => node.getClientRects().length > 0)
    // 注册表快照只取一次：下面所有结论都出自这一次读取，避免字段之间互相矛盾。
    const current = realEntries()
    const tampered = current
      .filter((entry) => {
        const want = lastWrote.get(entry.options.id)
        return want !== undefined && String(entry.options.order) !== want
      })
      .map((entry) => entry.options.id)
    if (current.length > 0 && lastWrote.size > 0) {
      if (tampered.length === 0) {
        // 连续多次干净才敢宣布冲突结束。
        conflictStrikes = Math.max(0, conflictStrikes - 1)
        if (conflictStrikes === 0) conflict = null
      } else {
        conflictStrikes += 1
        conflict = { strikes: conflictStrikes, paused: conflictStrikes >= 3, panels: tampered, at: new Date().toISOString() }
        if (conflictStrikes >= 3) paused = true
      }
    }
    api.report({
      version,
      kind: 'rebuild',
      status: store.getSnapshot().status,
      profileId: store.getSnapshot().profileId,
      railFound: rail !== null,
      rows: children.length,
      visibleRows: visible.length,
      rowLabels: children.map((node) => {
        const button = node.querySelector('button') ?? node
        const label = button.getAttribute?.('aria-label')
        if (typeof label === 'string' && label.length > 0) return label
        return (button.textContent ?? '').trim().slice(0, 24)
      }),
      hiddenMarkers: rail === null ? 0 : rail.querySelectorAll('[data-rk-hidden]').length,
      // 分组行的点击接管是否真的挂上了：这个数字应当等于 plan 里的分组数。
      groupRowsInDom: rail === null ? 0 : rail.querySelectorAll('[data-rk-group-row]').length,
      flyoutOpen: openGroup,
      flyoutOpens,
      flyoutFallbacks,
      menuItemClicks,
      selectNotes,
      layoutNotes,
      layoutReady: layoutService !== null,
      mainKeys: mainKeysOf(),
      selectProbe,
      clickProbe,
      flyoutListeners: flyoutCleanup !== null,
      live: current.map((entry) => entry.options.id),
      // 注册表里每个条目真正的 order（含本插件写进去的值），以及计划里的行顺序。
      // 「画出来的顺序」与这两者都不一致时，问题在内核的排序/渲染，不在计划。
      ledgerOrders: current.map((entry) => `${entry.options.id}=${String(entry.options.order)}`),
      // 谁覆盖了我们的值：lastWrote 是我们写下的，ledgerOrders 是现在注册表里的。
      appliedOrders: current.map((entry) => `${entry.options.id}=${lastWrote.get(entry.options.id) ?? '?'}`),
      conflict,
      conflictStrikes,
      paused,
      planRows: plan.rows.map((row) => `${row.kind}:${row.id}@${row.order}`),
      entries: current.length,
      groups: plan.groups.size,
      groupRows: [...plan.groups.keys()].length,
      activePanelId: activeId(),
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * 自检：分组菜单里的「选中某个成员」这条路到底通不通。
   *
   * 界面上的失败只表现为「点了没反应」，从外部看不出是哪一步断的。这里直接
   * 调用生产代码用的那个 selectPanel，把 activePanelId 读回来，再同步还原。
   * 两次状态变更在同一个 tick 里，React 会合并成一次渲染，所以用户看不到跳动。
   */
  function probeSelect() {
    const group = [...plan.groups.values()][0]
    if (group === undefined || group.members.length === 0) {
      selectProbe = { skipped: 'no-group' }
      report(true)
      return
    }
    const target = group.members.find((id) => canSelectPanel(id))
    if (target === undefined) {
      selectProbe = {
        skipped: 'no-selectable-member',
        members: group.members,
        mainKeys: mainKeysOf(),
      }
      report(true)
      return
    }
    const before = activeId()
    selectPanel(target)
    const after = activeId()
    // 还原：LayoutController.selectPanel 接受 null（回到会话），所以不走我自己的
    // 包装（那里会先查 canSelectPanel，null 过不了这一关）。
    if (after !== before) {
      try {
        layoutOf()?.selectPanel?.(before)
      } catch (error) {
        layoutNotes.push(`restore-failed:${error instanceof Error ? error.message : String(error)}`)
      }
    }
    selectProbe = {
      target,
      before: String(before),
      after: String(after),
      restored: String(activeId()),
      selectNotes: [...selectNotes],
    }
    report(true)
  }

  /**
   * 自检第二步：把弹出菜单真的打开，往第一个菜单项上派发一次点击，读回结果。
   *
   * 点菜单项在界面上是「点了没反应」的重灾区：事件走的是 React 的 portal，
   * 任何一环断掉都只表现为没反应。这里走的是和生产完全一样的路径——同一个
   * openFlyout、同一个 DOM 节点、同一种 MouseEvent——所以结论可信。
   * 副作用可控：菜单只出现两帧，选中的面板随后同步还原。
   */
  function probeMenuClick() {
    const group = [...plan.groups.values()][0]
    if (group === undefined) {
      clickProbe = { skipped: 'no-group' }
      report(true)
      return
    }
    const marker = document.querySelector(`[data-rk-group-row="${group.id}"]`)
    if (marker === null) {
      clickProbe = { skipped: 'no-row-in-dom', groupId: group.id }
      report(true)
      return
    }
    const before = String(activeId())
    const clicksBefore = menuItemClicks
    quietProbe = true
    openFlyout(group.id, marker)
    setTimeout(() => {
      quietProbe = false
      const items = [...document.querySelectorAll('.rk-flyout-item')]
      if (items.length === 0) {
        clickProbe = { opened: true, items: 0, reason: 'menu did not render' }
        closeFlyout()
        report(true)
        return
      }
      const first = items[0]
      first.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      const after = activeId()
      clickProbe = {
        opened: true,
        items: items.length,
        firstDisabled: first.disabled === true,
        firstLabel: (first.textContent ?? '').slice(0, 24),
        clickHandlers: menuItemClicks - clicksBefore,
        before,
        after: String(after),
        selectNotes: [...selectNotes],
      }
      if (String(after) !== before) {
        try {
          layoutOf()?.selectPanel?.(before === 'null' ? null : before)
        } catch (error) {
          layoutNotes.push(`click-probe-restore:${error instanceof Error ? error.message : String(error)}`)
        }
      }
      if (openGroup !== null) closeFlyout()
      report(true)
    }, 140)
  }

  /** 当前 main 槽位注册的 key（诊断用）。 */
  function mainKeysOf() {
    try {
      return ctx.slots.entriesOfSlot('main')
        .map((entry) => entry.options.key)
        .filter((key) => typeof key === 'string')
    } catch {
      return []
    }
  }

  /** 重建计划并改写注册表。 */
  function rebuild() {
    if (!started || disposed || applying) return
    applying = true
    try {
      const entries = realEntries()
      captureOriginals(entries)
      const live = livePanels(entries)
      const nextPlan = buildPlan(store.getSnapshot().config, live)
      syncGroups(nextPlan)
      let mutated = false
      for (const entry of entries) {
        if (applyEntry(entry, nextPlan)) mutated = true
      }
      plan = nextPlan
      bumpAndNotify()
      if (mutated) nudge()
      reportSoon()
    } finally {
      applying = false
    }
  }

  function schedule() {
    if (scheduled || disposed) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      rebuild()
    })
  }

  /**
   * 监听“可能有人在插件外面改了配置”的信号。
   *
   * 只监听窗口重新可见 / 获得焦点，不做轮询：这是手工编辑文件后的真实场景，
   * 而没有变化的常驻轮询只是白白打 HTTP。本地有未保存改动时 reload 会自行让路。
   */
  function listenForExternalReload() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    let pending = false
    const refresh = () => {
      if (pending || disposed) return
      pending = true
      void store.reload().finally(() => {
        pending = false
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', refresh)
    externalReloadCleanup = () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', refresh)
    }
  }

  function start() {
    if (started || disposed) return
    started = true
    ensureStyle()
    // layout 是可选服务：用 ctx.inject 声明依赖后取，这是内核支持的取法。
    // 直接 ctx.get('layout') 拿到的东西不保证可用（未声明 inject 时内核的行为
    // 是实现细节），而取不到时这里只会表现为「点了没反应」，最难查。
    try {
      ctx.inject(['layout'], (layoutCtx) => {
        const service = layoutCtx.get('layout')
        if (service !== undefined && service !== null) {
          layoutService = service
          schedule()
        }
      })
    } catch (error) {
      layoutNotes.push(`inject-failed:${error instanceof Error ? error.message : String(error)}`)
    }
    // 页面已经渲染过侧栏时直接打标（不等第一帧图标）。
    const existing = document.querySelector('[data-sidebar-scrollport] nav')
    if (existing !== null) tagRail(existing)

    unsubscribeStore = store.subscribe(() => schedule())
    // 外部改动（手工编辑 JSON、另一个会话、后台切回前台）也要跟上。
    listenForExternalReload()
    installFlyoutListeners()
    try {
      unsubscribeSlot = ctx.slots.subscribe('sidebar.panellist', () => schedule())
    } catch {
      unsubscribeSlot = null
    }
    try {
      unsubscribeDeclared = ctx.slots.inject('sidebar.panellist', () => {
        slotReady = true
        schedule()
        return () => {
          slotReady = false
        }
      })
    } catch {
      unsubscribeDeclared = null
    }
    // 起动后跑一次自检：先等计划建好，再直接验一遍「选中成员」这条路。
    setTimeout(() => {
      if (disposed) return
      probeSelect()
      setTimeout(() => {
        if (!disposed) probeMenuClick()
      }, 300)
    }, 1200)
    if (store.getSnapshot().status !== 'loading') schedule()
    else {
      const unsubscribe = store.subscribe(() => {
        if (store.getSnapshot().status === 'loading') return
        unsubscribe()
        schedule()
      })
    }
  }

  function dispose() {
    if (disposed) return
    disposed = true
    if (typeof unsubscribeStore === 'function') unsubscribeStore()
    if (typeof unsubscribeSlot === 'function') unsubscribeSlot()
    if (typeof unsubscribeDeclared === 'function') unsubscribeDeclared()
    if (typeof externalReloadCleanup === 'function') externalReloadCleanup()
    externalReloadCleanup = null
    if (typeof flyoutCleanup === 'function') flyoutCleanup()
    flyoutCleanup = null
    openGroup = null
    openAnchor = null
    for (const disposers of groupDisposers.values()) {
      for (const disposeGroup of disposers) {
        try {
          disposeGroup()
        } catch {
          // ignore
        }
      }
    }
    groupDisposers.clear()
    // 恢复原始 order/label/component。
    let restored = false
    for (const original of originals.values()) {
      const entry = original.entry
      if (entry === undefined) continue
      const touched = original.touched ?? {}
      // 条目已经被更新的某一代认领 → 本代无权回滚，碰它就是制造竞态。
      if (entry[ENTRY_OWNER] !== owner) continue
      try {
        if (Object.prototype.hasOwnProperty.call(touched, 'order')
          && entry.options.order === touched.order) {
          if (original.order === undefined) delete entry.options.order
          else entry.options.order = original.order
          restored = true
        }
        if (Object.prototype.hasOwnProperty.call(touched, 'label')
          && entry.options.label === touched.label) {
          if (original.label === undefined) delete entry.options.label
          else entry.options.label = original.label
          restored = true
        }
        if (Object.prototype.hasOwnProperty.call(touched, 'component')
          && entry.component === touched.component) {
          entry.component = original.component
          restored = true
        }
      } catch {
        // ignore one broken entry
      }
    }
    for (const original of originals.values()) {
      const entry = original.entry
      if (entry !== undefined && entry[ENTRY_OWNER] === owner) delete entry[ENTRY_OWNER]
    }
    originals.clear()
    wrappers.clear()
    labelThunks.clear()
    lastWrote.clear()
    if (restored) nudge()
    if (styleElement !== null && styleElement.isConnected) styleElement.remove()
    styleElement = null
    for (const nav of document.querySelectorAll(`[${RAIL_ATTR}]`)) nav.removeAttribute(RAIL_ATTR)
    listeners.clear()
  }

  return {
    start,
    dispose,
    subscribe,
    getVersion,
    getPlan() {
      return plan
    },
    getLive() {
      return livePanels(realEntries())
    },
    getRailElement() {
      return railElement
    },
    /** 某个面板的原始图标组件（设置页预览用）。 */
    originalComponent(id) {
      return originals.get(id)?.component ?? null
    },
    selectPanel,
    canSelectPanel,
    refresh() {
      schedule()
    },
    /** 从宿主重读配置（设置页的「重新读取」按钮用）。 */
    reloadFromHost() {
      return store.reload({ force: true })
    },
    /** createPortal 是否解析成功（诊断用）。 */
    portalResolved() {
      return PORTAL !== null
    },
    /** 与另一个左栏管理插件的冲突状态，供设置页显示。 */
    getConflict() {
      return conflict
    },
    /** 用户手动重试：清零计数、解除暂停、立刻重建。 */
    resume() {
      conflictStrikes = 0
      conflict = null
      paused = false
      schedule()
    },
  }
}