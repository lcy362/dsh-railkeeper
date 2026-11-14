/**
 * dsh-railkeeper —— 配置模型（宿主与浏览器共用）。
 *
 * 只依赖标准 JavaScript，不引第三方包：宿主用 `node --check` 就能验证，
 * 浏览器半区也能被构建脚本原样内联。
 *
 * 配置是一个纯 JSON 文档，全局只有一份，按 profile 分节存放在
 * `$DSH_HOME/railkeeper.json`：
 *
 * {
 *   "schemaVersion": 1,
 *   "sequence": [
 *     { "type": "panel", "id": "plugins" },
 *     { "type": "group", "id": "g_xxx", "label": "统计", "icon": "chart",
 *       "hidden": false, "members": ["dsh-context", "personal-kit-usage"] }
 *   ],
 *   "panels": {
 *     "schedules": { "hidden": true },
 *     "personal-kit-models": { "icon": "gear" }
 *   }
 * }
 *
 * `sequence` 只描述“顺序与分组关系”。`panels` 保存单个面板的覆盖项。
 * 不在 sequence 里的已注册面板由客户端追加到末尾；不在当前注册表里的
 * 条目会保留下来，等插件重装后自动回到原位。
 */

/** 当前配置结构版本。改字段语义时递增，并在宿主迁移。 */
export const SCHEMA_VERSION = 1

/** 本插件注册到侧栏/主区域的 id 前缀，用于把自己排除在管理范围外。 */
export const RAIL_ENTRY_PREFIX = 'railkeeper:'

/** 分组行在侧栏里的 id 前缀；完整 id 为 `${GROUP_ENTRY_PREFIX}${groupId}`。 */
export const GROUP_ENTRY_PREFIX = `${RAIL_ENTRY_PREFIX}group:`

/** 内置图标名单。配置只存名字，渲染由客户端负责。 */
export const BUILTIN_ICONS = [
  'grid', 'puzzle', 'sparkles', 'clock', 'terminal', 'plug', 'star', 'folder',
  'book', 'code', 'gear', 'chart', 'list', 'bell', 'bolt', 'shield', 'globe',
  'database', 'box', 'wrench', 'layers', 'compass', 'chat', 'home',
]

const ICON_SET = new Set(BUILTIN_ICONS)
const MAX_ID = 128
const MAX_LABEL = 80
const MAX_SEQUENCE = 200
const MAX_GROUP_MEMBERS = 64

/** @param {unknown} value */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 合法的条目 id：非空、去空白后不超过 128 字符、不含空白与控制字符。
 * 面板 id 由其它插件决定，这里只做结构校验，不限制字符表。
 * @param {unknown} value
 * @returns {string | null}
 */
function cleanId(value) {
  if (typeof value !== 'string') return null
  const id = value.trim()
  if (id.length === 0 || id.length > MAX_ID) return null
  if (/[\u0000-\u001f\u007f\s]/.test(id)) return null
  return id
}

/**
 * 用户可见名称：去掉首尾空白、压掉控制字符，最长 80 字符。
 * @param {unknown} value
 * @returns {string | null}
 */
function cleanLabel(value) {
  if (typeof value !== 'string') return null
  const label = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (label.length === 0 || label.length > MAX_LABEL) return null
  return label
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function cleanIcon(value) {
  return typeof value === 'string' && ICON_SET.has(value) ? value : null
}

/** @param {string} value */
export function isBuiltinIcon(value) {
  return ICON_SET.has(value)
}

/** 全新配置。 */
export function defaultConfig() {
  return { schemaVersion: SCHEMA_VERSION, sequence: [], panels: {} }
}

/**
 * 深拷贝配置（配置只含 JSON 值）。
 * @param {ReturnType<typeof defaultConfig>} config
 */
export function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config))
}

/**
 * 生成一个分组 id。只用于“用户新建分组”和导入修复；
 * 宿主不生成 id，避免同一份配置在不同进程里得到不同结果。
 * @param {number} [seed]
 */
export function createGroupId(seed) {
  const random = Math.random().toString(36).slice(2, 8)
  const base = Number.isFinite(seed) ? Number(seed).toString(36) : Date.now().toString(36)
  return `g_${base}_${random}`
}

/**
 * 宽松归一化：永远是“尽力修好”，同时把修不掉的问题记进 errors。
 * 宿主 PUT 在 `ok === false` 时拒绝写入；读取时可以接受修复后的结果。
 *
 * @param {unknown} raw
 * @returns {{ ok: boolean, config: ReturnType<typeof defaultConfig>, errors: string[] }}
 */
export function normalizeConfig(raw) {
  /** @type {string[]} */
  const errors = []
  if (!isRecord(raw)) {
    if (raw !== undefined) errors.push('config must be a JSON object')
    return { ok: errors.length === 0, config: defaultConfig(), errors }
  }

  /** @type {Record<string, { label?: string, icon?: string, hidden?: boolean }>} */
  const panels = {}
  if (isRecord(raw.panels)) {
    for (const [key, value] of Object.entries(raw.panels)) {
      const id = cleanId(key)
      if (id === null) {
        errors.push(`invalid panel id ${JSON.stringify(String(key)).slice(0, 40)}`)
        continue
      }
      if (!isRecord(value)) {
        errors.push(`panel "${id}" overrides must be an object`)
        continue
      }
      /** @type {{ label?: string, icon?: string, hidden?: boolean }} */
      const override = {}
      if (value.label !== undefined) {
        const label = cleanLabel(value.label)
        if (label === null) errors.push(`panel "${id}" has an invalid label`)
        else override.label = label
      }
      if (value.icon !== undefined && value.icon !== null) {
        const icon = cleanIcon(value.icon)
        if (icon === null) errors.push(`panel "${id}" has an unknown icon`)
        else override.icon = icon
      }
      if (value.hidden !== undefined) {
        if (typeof value.hidden !== 'boolean') errors.push(`panel "${id}" hidden must be a boolean`)
        else if (value.hidden) override.hidden = true
      }
      if (Object.keys(override).length > 0) panels[id] = override
    }
  } else if (raw.panels !== undefined) {
    errors.push('panels must be an object')
  }

  /** @type {Array<{ type: 'panel', id: string } | { type: 'group', id: string, label?: string, icon?: string, hidden?: boolean, members: string[] }>} */
  const sequence = []
  const seen = new Set()
  const rawSequence = Array.isArray(raw.sequence) ? raw.sequence : []
  if (raw.sequence !== undefined && !Array.isArray(raw.sequence)) errors.push('sequence must be an array')
  if (rawSequence.length > MAX_SEQUENCE) {
    errors.push(`sequence is limited to ${MAX_SEQUENCE} rows`)
  }

  for (const item of rawSequence.slice(0, MAX_SEQUENCE)) {
    if (!isRecord(item)) {
      errors.push('sequence row must be an object')
      continue
    }
    const type = item.type === 'group' ? 'group' : 'panel'
    if (type === 'panel') {
      const id = cleanId(item.id)
      if (id === null) {
        errors.push('sequence panel row is missing a valid id')
        continue
      }
      if (seen.has(id)) {
        errors.push(`panel "${id}" appears more than once`)
        continue
      }
      seen.add(id)
      sequence.push({ type: 'panel', id })
      continue
    }

    // group
    let membersRaw = Array.isArray(item.members) ? item.members : []
    if (!Array.isArray(item.members)) errors.push('group members must be an array')
    if (membersRaw.length > MAX_GROUP_MEMBERS) {
      errors.push(`a group holds at most ${MAX_GROUP_MEMBERS} panels`)
      membersRaw = membersRaw.slice(0, MAX_GROUP_MEMBERS)
    }
    const members = []
    for (const memberRaw of membersRaw) {
      const member = cleanId(memberRaw)
      if (member === null) {
        errors.push('group member is not a valid panel id')
        continue
      }
      if (seen.has(member) || members.includes(member)) continue
      members.push(member)
    }
    if (members.length === 0) {
      errors.push('a group needs at least one member')
      continue
    }
    let id = cleanId(item.id)
    if (id === null) {
      id = createGroupId(sequence.length)
    }
    if (seen.has(id)) {
      errors.push(`group id "${id}" collides with another row`)
      continue
    }
    for (const member of members) seen.add(member)
    seen.add(id)
    /** @type {{ type: 'group', id: string, label?: string, icon?: string, hidden?: boolean, members: string[] }} */
    const group = { type: 'group', id, members }
    if (item.label !== undefined) {
      const label = cleanLabel(item.label)
      if (label === null) errors.push(`group "${id}" has an invalid label`)
      else group.label = label
    }
    if (item.icon !== undefined && item.icon !== null) {
      const icon = cleanIcon(item.icon)
      if (icon === null) errors.push(`group "${id}" has an unknown icon`)
      else group.icon = icon
    }
    if (item.hidden === true) group.hidden = true
    sequence.push(group)
  }

  return {
    ok: errors.length === 0,
    config: { schemaVersion: SCHEMA_VERSION, sequence, panels },
    errors,
  }
}