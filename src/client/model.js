/**
 * dsh-railkeeper —— 配置编辑与渲染计划（纯函数）。
 *
 * 这里不碰 React、不碰 DOM，方便用 `node --test` 直接覆盖。
 *
 * 术语：
 * - live：当前 `sidebar.panellist` 里由其它插件注册的面板
 *   `[{ id, order, label }]`，order 为注册顺序。
 * - plan：由配置 + live 推导出的“这一帧要怎么排、哪些要隐藏”的结果。
 * - sequence：用户配置里的行顺序；panel 行和 group 行共用同一个 id 空间。
 */
import { cloneConfig, createGroupId, defaultConfig } from '../shared/config.js'

/** @param {unknown} value */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 把 live 里还没被配置引用的面板追加到 sequence 末尾。
 * 只追加、不删除：卸载掉的面板行会保留，等插件回来恢复原位。
 *
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {Array<{ id: string, order: number, label: string }>} live
 */
export function materialize(config, live) {
  const next = cloneConfig(config)
  const seen = new Set()
  for (const row of next.sequence) {
    if (row.type === 'panel') seen.add(row.id)
    else for (const member of row.members) seen.add(member)
  }
  for (const panel of live) {
    if (!seen.has(panel.id)) {
      next.sequence.push({ type: 'panel', id: panel.id })
      seen.add(panel.id)
    }
  }
  return next
}

/**
 * 推导渲染计划。
 *
 * - sequence 里已安装的面板/分组按顺序占一行；
 * - 未安装的面板行、空分组跳过；
 * - live 中未出现在 sequence 里的面板按注册顺序追加到末尾；
 * - 分组内的成员不再有自己的行，统一标记 hidden + grouped。
 *
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {Array<{ id: string, order: number, label: string }>} live
 */
export function buildPlan(config, live) {
  const byId = new Map(live.map((panel) => [panel.id, panel]))
  /** @type {Array<{ kind: 'panel' | 'group', id: string, order: number }>} */
  const rows = []
  /** @type {Map<string, { id: string, order: number, hidden: boolean, grouped: boolean, groupId: string | null, label: string, icon: string | null }>} */
  const panels = new Map()
  /** @type {Map<string, { id: string, label: string, icon: string | null, hidden: boolean, members: string[], order: number }>} */
  const groups = new Map()
  const seen = new Set()
  let index = 0

  for (const row of config.sequence) {
    const override = row.type === 'panel' ? (config.panels[row.id] ?? {}) : {}
    if (row.type === 'panel') {
      const panel = byId.get(row.id)
      if (panel === undefined || seen.has(row.id)) continue
      seen.add(row.id)
      const order = 100 + index * 10
      panels.set(row.id, {
        id: row.id,
        order,
        hidden: override.hidden === true,
        grouped: false,
        groupId: null,
        label: override.label ?? panel.label ?? row.id,
        icon: override.icon ?? null,
      })
      rows.push({ kind: 'panel', id: row.id, order })
      index += 1
      continue
    }

    // group
    const members = row.members.filter((id) => byId.has(id) && !seen.has(id))
    if (members.length === 0) continue
    const order = 100 + index * 10
    for (const id of members) {
      seen.add(id)
      const panel = byId.get(id)
      const panelOverride = config.panels[id] ?? {}
      // 成员排在分组行之后：它们本身是隐藏的，但下标顺序要和计划一致，
      // 否则「更多」菜单里的顺序会变得随机。
      panels.set(id, {
        id,
        order: order + 1,
        hidden: true,
        grouped: true,
        groupId: row.id,
        label: panelOverride.label ?? panel.label ?? id,
        icon: panelOverride.icon ?? null,
      })
    }
    groups.set(row.id, {
      id: row.id,
      label: row.label ?? '',
      icon: row.icon ?? null,
      hidden: row.hidden === true,
      members,
      order,
    })
    rows.push({ kind: 'group', id: row.id, order })
    index += 1
  }

  // 未写进 sequence 的面板追加到末尾，保持注册顺序。
  const rest = live.filter((panel) => !seen.has(panel.id)).sort((a, b) => a.order - b.order)
  for (const panel of rest) {
    const override = config.panels[panel.id] ?? {}
    const order = 100 + index * 10
    panels.set(panel.id, {
      id: panel.id,
      order,
      hidden: override.hidden === true,
      grouped: false,
      groupId: null,
      label: override.label ?? panel.label ?? panel.id,
      icon: override.icon ?? null,
    })
    rows.push({ kind: 'panel', id: panel.id, order })
    index += 1
  }

  return { rows, panels, groups }
}

/**
 * 行在 sequence 中的下标。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} rowId
 */
export function rowIndex(config, rowId) {
  return config.sequence.findIndex((row) => row.id === rowId)
}

/**
 * 把某一行移动 delta 步（负数为上移）。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {Array<{ id: string, order: number, label: string }>} live
 * @param {string} rowId
 * @param {number} delta
 */
export function moveRow(config, live, rowId, delta) {
  const next = materialize(config, live)
  const from = rowIndex(next, rowId)
  if (from < 0) return next
  const to = Math.max(0, Math.min(next.sequence.length - 1, from + delta))
  if (to === from) return next
  const [row] = next.sequence.splice(from, 1)
  next.sequence.splice(to, 0, row)
  return next
}

/**
 * 把某一行移动到目标行之前（拖拽用）；目标在下方时按“移走后再定位”处理。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {Array<{ id: string, order: number, label: string }>} live
 * @param {string} rowId
 * @param {string} targetId
 */
export function moveRowBefore(config, live, rowId, targetId) {
  const next = materialize(config, live)
  const from = rowIndex(next, rowId)
  const to = rowIndex(next, targetId)
  if (from < 0 || to < 0 || rowId === targetId) return next
  // 目标下标要在移走被拖拽行之前算：向下拖时目标会跟着前移一位，
  // 用移走之后的下标会让「拖到下一行」变成原地不动。
  const [row] = next.sequence.splice(from, 1)
  next.sequence.splice(to, 0, row)
  return next
}

/**
 * 把若干顶层面板合并成一个新分组，插在最早出现的位置。
 * 只处理顶层 panel 行；成员顺序沿用 sequence 顺序。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {Array<{ id: string, order: number, label: string }>} live
 * @param {string[]} ids
 */
export function groupPanels(config, live, ids) {
  const next = materialize(config, live)
  const wanted = new Set(ids)
  const picked = next.sequence.filter((row) => row.type === 'panel' && wanted.has(row.id))
  if (picked.length < 2) return next
  const firstIndex = next.sequence.findIndex((row) => row.type === 'panel' && wanted.has(row.id))
  next.sequence = next.sequence.filter((row) => !(row.type === 'panel' && wanted.has(row.id)))
  const group = { type: 'group', id: createGroupId(), members: picked.map((row) => row.id) }
  next.sequence.splice(firstIndex < 0 ? next.sequence.length : firstIndex, 0, group)
  return next
}

/**
 * 解散分组：成员按原顺序变成顶层面板行。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} groupId
 */
export function ungroup(config, groupId) {
  const next = cloneConfig(config)
  const index = rowIndex(next, groupId)
  if (index < 0) return next
  const row = next.sequence[index]
  if (row.type !== 'group') return next
  const members = row.members.map((id) => ({ type: 'panel', id }))
  next.sequence.splice(index, 1, ...members)
  return next
}

/**
 * 把成员移出分组：成员成为紧跟分组后面的顶层面板。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} groupId
 * @param {string} memberId
 */
export function removeMember(config, groupId, memberId) {
  const next = cloneConfig(config)
  const index = rowIndex(next, groupId)
  if (index < 0) return next
  const row = next.sequence[index]
  if (row.type !== 'group' || !row.members.includes(memberId)) return next
  row.members = row.members.filter((id) => id !== memberId)
  next.sequence.splice(index + 1, 0, { type: 'panel', id: memberId })
  if (row.members.length === 0) next.sequence.splice(index, 1)
  return next
}

/**
 * 删除某个顶层面板行（只用于“已配置但未安装”的孤儿行）。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} panelId
 */
export function removePanelRow(config, panelId) {
  const next = cloneConfig(config)
  next.sequence = next.sequence.filter((row) => !(row.type === 'panel' && row.id === panelId))
  if (isRecord(next.panels)) delete next.panels[panelId]
  return next
}

/**
 * 设置面板覆盖项；空值表示删除该字段。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} panelId
 * @param {'label' | 'icon' | 'hidden'} field
 * @param {string | boolean | null | undefined} value
 */
export function setPanelField(config, panelId, field, value) {
  const next = cloneConfig(config)
  const current = isRecord(next.panels[panelId]) ? { ...next.panels[panelId] } : {}
  if (value === null || value === undefined || value === '' || value === false) {
    delete current[field]
  } else {
    current[field] = value
  }
  if (Object.keys(current).length === 0) delete next.panels[panelId]
  else next.panels[panelId] = current
  return next
}

/**
 * 设置分组字段（label / icon / hidden）。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} groupId
 * @param {'label' | 'icon' | 'hidden'} field
 * @param {string | boolean | null | undefined} value
 */
export function setGroupField(config, groupId, field, value) {
  const next = cloneConfig(config)
  const row = next.sequence.find((candidate) => candidate.id === groupId && candidate.type === 'group')
  if (row === undefined) return next
  if (value === null || value === undefined || value === '' || value === false) {
    delete row[field]
  } else {
    row[field] = value
  }
  return next
}

/**
 * 清空某个面板的全部覆盖项。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} panelId
 */
export function clearPanelOverride(config, panelId) {
  const next = cloneConfig(config)
  delete next.panels[panelId]
  return next
}

/**
 * 清空分组自己的外观覆盖（名称/图标/隐藏），保留成员。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} groupId
 */
export function clearGroupOverride(config, groupId) {
  const next = cloneConfig(config)
  const row = next.sequence.find((candidate) => candidate.id === groupId && candidate.type === 'group')
  if (row === undefined) return next
  delete row.label
  delete row.icon
  delete row.hidden
  return next
}

/**
 * 取分组行。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} groupId
 */
export function findGroup(config, groupId) {
  return config.sequence.find((row) => row.type === 'group' && row.id === groupId)
}

/**
 * 配置里出现、但当前 live 中不存在的面板 id。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {Array<{ id: string }>} live
 */
export function findOrphans(config, live) {
  const liveIds = new Set(live.map((panel) => panel.id))
  const ids = new Set()
  for (const row of config.sequence) {
    if (row.type === 'panel' && !liveIds.has(row.id)) ids.add(row.id)
    if (row.type === 'group') {
      for (const member of row.members) if (!liveIds.has(member)) ids.add(member)
    }
  }
  return [...ids]
}