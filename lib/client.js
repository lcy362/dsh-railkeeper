/**
 * dsh-railkeeper 浏览器半区。
 * 构建产物，请勿直接编辑：改 src/client/*.js 后运行 `node scripts/build-client.mjs`。
 * 形式遵循宿主契约：window.__ModuleLoader__.load({ id, factory }) + 同步 require。
 */
window.__ModuleLoader__.load({
  id: "dsh-railkeeper",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const __rkRequire = require;

// ---- src/client/api.js ----
const __rkm0 = (() => {
  const __rkExports = {};
/**
 * dsh-railkeeper —— 宿主 API 客户端。
 *
 * 所有请求都是相对路径：桌面版由 Electron 的 fetch 桥接转发到本机 webServer，
 * 浏览器版就是同源请求。写请求带 JSON body，不做任何凭据处理。
 */

const BASE = '/railkeeper/api'

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, timeoutMs?: number }} [options]
 */
async function request(path, options = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined
  const timer = controller === undefined
    ? undefined
    : setTimeout(() => controller.abort(), options.timeoutMs ?? 6000)
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller?.signal,
    })
  } catch (error) {
    throw Object.assign(new Error(messageOf(error)), { code: 'network' })
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
  const text = await response.text()
  let payload
  try {
    payload = text.length === 0 ? undefined : JSON.parse(text)
  } catch {
    payload = undefined
  }
  if (!response.ok) {
    const detail = payload !== undefined && typeof payload === 'object' && typeof payload.error === 'string'
      ? payload.error
      : `HTTP ${response.status}`
    const error = new Error(detail)
    // @ts-expect-error 诊断字段
    error.status = response.status
    // @ts-expect-error 诊断字段
    error.details = payload?.details
    throw error
  }
  return payload
}

/** @param {unknown} error */
function describeApiError(error) {
  if (error instanceof Error && error.message.length > 0) return error.message
  return String(error)
}

function createApi() {
  return {
    async load() {
      return request('/config')
    },
    async save(config) {
      return request('/config', { method: 'PUT', body: { config } })
    },
    async reset() {
      return request('/config/reset', { method: 'POST', body: {} })
    },
    /** 失败静默：诊断上报不能影响界面。 */
    report(payload) {
      try {
        void request('/client-status', { method: 'POST', body: payload, timeoutMs: 2500 }).catch(() => {})
      } catch {
        // ignore
      }
    },
    async clientStatus() {
      return request('/client-status')
    },
    /** 读取旧插件 dsh-panellist 的配置并转换为本插件结构。 */
    async legacy() {
      return request('/legacy')
    },
  }
}
  __rkExports["describeApiError"] = describeApiError;
  __rkExports["createApi"] = createApi;
  return Object.freeze(__rkExports);
})();

// ---- src/client/i18n.js ----
const __rkm1 = (() => {
  const __rkExports = {};
/**
 * dsh-railkeeper —— 浏览器半区文案。
 *
 * 不注册 locale 命名空间，只读内核 locale 服务的当前语言并本地取词：
 * 这样少一个“服务缺失就整包不加载”的硬依赖，切换语言也能立即重渲染。
 */

/** @type {Record<'zh' | 'en', Record<string, string>>} */
const DICT = {
  zh: {
    'section.label': '面板列表',
    'title': '面板列表',
    'subtitle': '管理左侧栏面板的顺序、名称、图标、显示状态和分组。改动即时生效。',
    'status.loading': '读取配置…',
    'status.saving': '保存中…',
    'status.saved': '已保存',
    'status.dirty': '有改动待保存',
    'status.error': '保存失败：{message}',
    'status.offline': '宿主不可用，改动只保留在当前页面',
    'actions.reset': '全部重置',
    'actions.resetConfirm': '再点一次确认重置',
    'actions.retry': '重试',
    'actions.import': '导入',
    'actions.export': '导出',
    'actions.copy': '复制 JSON',
    'actions.copied': '已复制',
    'actions.group': '合并为分组',
    'actions.ungroup': '解散分组',
    'actions.remove': '移除',
    'actions.removeFromGroup': '移出分组',
    'actions.up': '上移',
    'actions.down': '下移',
    'actions.hide': '隐藏',
    'actions.show': '显示',
    'actions.originalIcon': '原始图标',
    'actions.clearOverride': '恢复默认',
    'actions.select': '选择',
    'actions.selectAll': '全选',
    'actions.clearSelection': '取消选择',
    'row.missing': '未安装',
    'row.memberCount': '{count} 个面板',
    'row.drag': '拖动排序',
    'row.group': '分组',
    'row.ungrouped': '未分组',
    'name.panelPlaceholder': '面板名称',
    'name.groupPlaceholder': '分组名称',
    'group.defaultName': '分组',
    'group.members': '成员',
    'group.empty': '这个分组还没有成员。',
    'page.groupIntro': '这个分组里的面板：{members}。点左侧栏的分组行会直接弹出列表。',
    'flyout.title': '成员',
    'icon.title': '选择图标',
    'io.title': '导入 / 导出',
    'io.hint': '导出的 JSON 可以备份、迁移到别的机器，或提交到仓库。导入会整体替换当前配置。',
    'io.placeholder': '在这里粘贴 railkeeper 配置 JSON…',
    'io.import': '导入并保存',
    'io.invalid': '导入失败：{message}',
    'io.confirm': '导入会替换当前配置，继续？',
    'empty.title': '左侧栏还没有可管理的面板',
    'empty.hint': '等其它插件注册面板后，这里会自动出现。',
    'orphans.title': '已配置但当前未安装',
    'orphans.hint': '这些面板暂时不在注册表里。保留配置，等插件回来会自动恢复；也可以直接移除。',
    'error.load': '读取配置失败：{message}',
    'error.save': '写入配置失败：{message}',
    'error.host': '宿主半区没有响应。确认 dsh-railkeeper 已启用，然后重试。',
    'error.duplicate': '分组里不能重复选择同一个面板。',
    'error.selectionGroup': '分组不能再次合并，请先取消选择分组行。',
    'conflict.title': '检测到另一个左栏管理插件',
    'conflict.body': '还有别的插件在改同一批面板（最常见的是刚停用 dsh-panellist、但页面还没重载）。为避免两边互相覆盖，本插件已暂停改写顺序与名称，只保留「隐藏」标记。重新加载页面（⌘R）或重启应用后即恢复正常。',
    'conflict.panels': '受影响的面板：{panels}',
    'conflict.resume': '我已重载，重试',
    'migrate.button': '从 dsh-panellist 导入',
    'migrate.none': '没有找到 panellist.json，或里面没有当前配置档案的配置。',
    'migrate.done': '已导入 {count} 行配置。',
    'migrate.confirm': '导入会替换当前配置，继续？',
    'probe.button': '跑一次自检',
    'probe.confirm': '会切换面板，确认？',
    'probe.hint': '自检会真的切一次面板再切回来，侧栏会闪一下。只在排查「点了没反应」时用。',
    'star.title': '喜欢就点个 star',
    'star.body': '这个插件是作者业余时间做的，没有广告也没有付费版。如果你觉得好用，去 GitHub 点个 star 就是最好的支持——作者看到会很高兴。',
    'star.action': '去 GitHub 点 star',
    'star.dismiss': '以后再说',
    'footer.profile': '配置档案：{profile}',
    'footer.path': '存储位置：{path}',
    'hint.grouping': '勾选两个以上面板，可以合并成一个分组；分组会占用左侧栏一行，点开显示成员。',
    'hint.drag': '拖动左侧手柄排序；键盘可以用上移/下移。',
    'badge.hidden': '已隐藏',
    'badge.customLabel': '已改名',
    'badge.customIcon': '已换图标',
    'untitled': '未命名',
  },
  en: {
    'section.label': 'Panel list',
    'title': 'Panel list',
    'subtitle': 'Manage the order, names, icons, visibility and groups of the left rail. Changes apply instantly.',
    'status.loading': 'Loading configuration…',
    'status.saving': 'Saving…',
    'status.saved': 'Saved',
    'status.dirty': 'Unsaved changes',
    'status.error': 'Save failed: {message}',
    'status.offline': 'Host unavailable; changes stay in this page only',
    'actions.reset': 'Reset all',
    'actions.resetConfirm': 'Click again to reset',
    'actions.retry': 'Retry',
    'actions.import': 'Import',
    'actions.export': 'Export',
    'actions.copy': 'Copy JSON',
    'actions.copied': 'Copied',
    'actions.group': 'Group selected',
    'actions.ungroup': 'Ungroup',
    'actions.remove': 'Remove',
    'actions.removeFromGroup': 'Remove from group',
    'actions.up': 'Move up',
    'actions.down': 'Move down',
    'actions.hide': 'Hide',
    'actions.show': 'Show',
    'actions.originalIcon': 'Original icon',
    'actions.clearOverride': 'Reset',
    'actions.select': 'Select',
    'actions.selectAll': 'Select all',
    'actions.clearSelection': 'Clear selection',
    'row.missing': 'Not installed',
    'row.memberCount': '{count} panels',
    'row.drag': 'Drag to reorder',
    'row.group': 'Group',
    'row.ungrouped': 'Not grouped',
    'name.panelPlaceholder': 'Panel name',
    'name.groupPlaceholder': 'Group name',
    'group.defaultName': 'Group',
    'group.members': 'Members',
    'group.empty': 'This group has no members yet.',
    'page.groupIntro': 'Panels collected in this group: {members}. Clicking the group row in the rail opens the same list as a menu.',
    'flyout.title': 'Members',
    'icon.title': 'Choose an icon',
    'io.title': 'Import / export',
    'io.hint': 'Exported JSON backs up the configuration or moves it to another machine. Importing replaces the whole configuration.',
    'io.placeholder': 'Paste a railkeeper configuration JSON here…',
    'io.import': 'Import and save',
    'io.invalid': 'Import failed: {message}',
    'io.confirm': 'Importing replaces the current configuration. Continue?',
    'empty.title': 'No rail panels to manage yet',
    'empty.hint': 'Panels appear here as other plugins register them.',
    'orphans.title': 'Configured but not installed',
    'orphans.hint': 'These panels are not registered right now. Their configuration is kept for when they return; you can also remove it.',
    'error.load': 'Could not read the configuration: {message}',
    'error.save': 'Could not save the configuration: {message}',
    'error.host': 'The host half did not answer. Check that dsh-railkeeper is enabled, then retry.',
    'error.duplicate': 'A panel can appear only once in a group.',
    'error.selectionGroup': 'Groups cannot be merged into another group.',
    'conflict.title': 'Another rail manager is active',
    'conflict.body': 'Another plugin is still rewriting the same panels — most often a just-disabled dsh-panellist whose code is still loaded in this page. To avoid both sides overwriting each other, rewriting of order and names is paused; hide markers are kept. Reload the page (Cmd+R) or restart the app to recover.',
    'conflict.panels': 'Affected panels: {panels}',
    'conflict.resume': 'Reloaded — retry',
    'migrate.button': 'Import from dsh-panellist',
    'migrate.none': 'No panellist.json found, or it holds no configuration for this profile.',
    'migrate.done': 'Imported {count} rows.',
    'migrate.confirm': 'Importing replaces the current configuration. Continue?',
    'probe.button': 'Run self-test',
    'probe.confirm': 'It will switch panels — confirm?',
    'probe.hint': 'The self-test really selects a panel and switches back, so the rail flashes once. Use it when diagnosing "clicking does nothing".',
    'star.title': 'A star would make the author’s day',
    'star.body': 'This plugin is built in the author’s spare time — no ads, no paid tier. If it helps you, a star on GitHub is the best thank-you: the author will be genuinely happy to see it.',
    'star.action': 'Star on GitHub',
    'star.dismiss': 'Maybe later',
    'footer.profile': 'Profile: {profile}',
    'footer.path': 'Stored at: {path}',
    'hint.grouping': 'Select two or more panels to merge them into a group. A group takes one rail row and opens its members.',
    'hint.drag': 'Drag the handle to reorder; the arrow buttons work from the keyboard.',
    'badge.hidden': 'Hidden',
    'badge.customLabel': 'Renamed',
    'badge.customIcon': 'Custom icon',
    'untitled': 'Untitled',
  },
}

/**
 * 把任意语言标记归一到本插件支持的两种。
 * @param {unknown} value
 */
function normalizeLang(value) {
  const text = typeof value === 'string' ? value.toLowerCase() : ''
  return text.startsWith('zh') ? 'zh' : 'en'
}

/** @param {unknown} ctx */
function safeGet(ctx, name) {
  try {
    return ctx.get(name)
  } catch {
    return undefined
  }
}

/**
 * 创建翻译器：订阅内核 locale 变化，读不到服务时退回浏览器语言。
 * @param {{ get?: (name: string) => unknown, inject?: Function }} ctx
 */
function createI18n(ctx) {
  const listeners = new Set()
  let service
  let unsubscribe

  /** @returns {'zh' | 'en'} */
  function lang() {
    try {
      const active = service?.getLocale?.()?.active
      if (typeof active === 'string' && active.length > 0) return normalizeLang(active)
    } catch {
      // fall through
    }
    try {
      return normalizeLang(navigator.language)
    } catch {
      return 'en'
    }
  }

  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        // a listener must not break the translator
      }
    }
  }

  /** @param {any} next */
  function attach(next) {
    if (next === service) return
    if (typeof unsubscribe === 'function') unsubscribe()
    service = next
    unsubscribe = undefined
    try {
      unsubscribe = service?.subscribe?.(notify)
    } catch {
      unsubscribe = undefined
    }
    notify()
  }

  const initial = safeGet(ctx, 'locale')
  if (initial !== undefined) attach(initial)
  try {
    ctx.inject?.(['locale'], (localeCtx) => {
      const service = localeCtx.get('locale')
      if (service !== undefined) attach(service)
    })
  } catch {
    // optional service
  }

  /**
   * @param {string} key
   * @param {Record<string, string | number>} [vars]
   */
  function t(key, vars) {
    const table = DICT[lang()] ?? DICT.en
    let text = table[key] ?? DICT.en[key] ?? key
    if (vars !== undefined) {
      text = text.replace(/\{(\w+)\}/g, (match, name) => (
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
      ))
    }
    return text
  }

  return {
    lang,
    t,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      listeners.clear()
      if (typeof unsubscribe === 'function') unsubscribe()
      unsubscribe = undefined
      service = undefined
    },
  }
}
  __rkExports["normalizeLang"] = normalizeLang;
  __rkExports["createI18n"] = createI18n;
  return Object.freeze(__rkExports);
})();

// ---- src/shared/config.js ----
const __rkm2 = (() => {
  const __rkExports = {};
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
const SCHEMA_VERSION = 1

/** 本插件注册到侧栏/主区域的 id 前缀，用于把自己排除在管理范围外。 */
const RAIL_ENTRY_PREFIX = 'railkeeper:'

/** 分组行在侧栏里的 id 前缀；完整 id 为 `${GROUP_ENTRY_PREFIX}${groupId}`。 */
const GROUP_ENTRY_PREFIX = `${RAIL_ENTRY_PREFIX}group:`

/** 内置图标名单。配置只存名字，渲染由客户端负责。 */
const BUILTIN_ICONS = [
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
function cleanIcon(value) {
  return typeof value === 'string' && ICON_SET.has(value) ? value : null
}

/** @param {string} value */
function isBuiltinIcon(value) {
  return ICON_SET.has(value)
}

/** 全新配置。 */
function defaultConfig() {
  return { schemaVersion: SCHEMA_VERSION, sequence: [], panels: {} }
}

/**
 * 深拷贝配置（配置只含 JSON 值）。
 * @param {ReturnType<typeof defaultConfig>} config
 */
function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config))
}

/**
 * 生成一个分组 id。只用于“用户新建分组”和导入修复；
 * 宿主不生成 id，避免同一份配置在不同进程里得到不同结果。
 * @param {number} [seed]
 */
function createGroupId(seed) {
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
function normalizeConfig(raw) {
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
  __rkExports["SCHEMA_VERSION"] = SCHEMA_VERSION;
  __rkExports["RAIL_ENTRY_PREFIX"] = RAIL_ENTRY_PREFIX;
  __rkExports["GROUP_ENTRY_PREFIX"] = GROUP_ENTRY_PREFIX;
  __rkExports["BUILTIN_ICONS"] = BUILTIN_ICONS;
  __rkExports["cleanIcon"] = cleanIcon;
  __rkExports["isBuiltinIcon"] = isBuiltinIcon;
  __rkExports["defaultConfig"] = defaultConfig;
  __rkExports["cloneConfig"] = cloneConfig;
  __rkExports["createGroupId"] = createGroupId;
  __rkExports["normalizeConfig"] = normalizeConfig;
  return Object.freeze(__rkExports);
})();

// ---- src/client/icons.js ----
const __rkm3 = (() => {
  const __rkExports = {};
/**
 * dsh-railkeeper —— 内置图标。
 *
 * 全部是 16×16 线条稿，`stroke="currentColor"`，沿用内核侧栏图标的观感。
 * 这里不引用任何 Harness 客户端包，避免内核升级时命名导出消失把入口打崩。
 */
const React = __rkRequire("react");
const { BUILTIN_ICONS } = __rkm2;

const h = React.createElement

/** @type {Record<string, Array<[string, Record<string, unknown>]>>} */
const SHAPES = {
  grid: [
    ['rect', { x: 2.5, y: 2.5, width: 4.6, height: 4.6, rx: 1 }],
    ['rect', { x: 8.9, y: 2.5, width: 4.6, height: 4.6, rx: 1 }],
    ['rect', { x: 2.5, y: 8.9, width: 4.6, height: 4.6, rx: 1 }],
    ['rect', { x: 8.9, y: 8.9, width: 4.6, height: 4.6, rx: 1 }],
  ],
  puzzle: [
    ['path', { d: 'M3 3h4.2v1.6a1.8 1.8 0 1 0 1.6 0V3H13v4.2h-1.6a1.8 1.8 0 1 0 0 1.6H13V13H8.8v-1.6a1.8 1.8 0 1 0-1.6 0V13H3V8.8h1.6a1.8 1.8 0 1 0 0-1.6H3z' }],
  ],
  sparkles: [
    ['path', { d: 'M6 2.2l.9 2.4 2.4.9-2.4.9L6 8.8l-.9-2.4-2.4-.9 2.4-.9z' }],
    ['path', { d: 'M11.4 8.3l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z' }],
  ],
  clock: [
    ['circle', { cx: 8, cy: 8, r: 5.8 }],
    ['path', { d: 'M8 4.6V8l2.6 1.8' }],
  ],
  terminal: [
    ['rect', { x: 1.8, y: 3, width: 12.4, height: 10, rx: 1.4 }],
    ['path', { d: 'M4.6 6.4l2.2 2.2-2.2 2.2' }],
    ['path', { d: 'M9 11h2.8' }],
  ],
  plug: [
    ['path', { d: 'M5.6 2v3.4M10.4 2v3.4' }],
    ['path', { d: 'M3.6 5.4h8.8v2.2a4.4 4.4 0 0 1-8.8 0z' }],
    ['path', { d: 'M8 12v2.2' }],
  ],
  star: [
    ['path', { d: 'M8 2.4l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11.1 4.6 12.9l.7-3.8L2.5 6.4l3.8-.5z' }],
  ],
  folder: [
    ['path', { d: 'M1.8 12.6V4.2a1 1 0 0 1 1-1h3.1l1.4 1.9h5.9a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z' }],
  ],
  book: [
    ['path', { d: 'M8 4.3C6.9 3.4 5.6 3 3 3v9.3c2.6 0 3.9.5 5 1.4 1.1-.9 2.4-1.4 5-1.4V3c-2.6 0-3.9.4-5 1.3z' }],
    ['path', { d: 'M8 4.3v9.4' }],
  ],
  code: [
    ['path', { d: 'M6.2 4.6L2.6 8l3.6 3.4M9.8 4.6L13.4 8l-3.6 3.4' }],
    ['path', { d: 'M9.2 2.8l-2.4 10.4' }],
  ],
  gear: [
    ['circle', { cx: 8, cy: 8, r: 2.2 }],
    ['path', { d: 'M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2' }],
    ['circle', { cx: 8, cy: 8, r: 5.6 }],
  ],
  chart: [
    ['path', { d: 'M2.4 13.4h11.2' }],
    ['path', { d: 'M4.8 13.4V9.2M8 13.4V5.4M11.2 13.4v-2.6' }],
  ],
  list: [
    ['circle', { cx: 2.7, cy: 3.6, r: 0.7, filled: true }],
    ['circle', { cx: 2.7, cy: 8, r: 0.7, filled: true }],
    ['circle', { cx: 2.7, cy: 12.4, r: 0.7, filled: true }],
    ['path', { d: 'M5.6 3.6h8.2M5.6 8h8.2M5.6 12.4h8.2' }],
  ],
  bell: [
    ['path', { d: 'M4.4 12.4V8.4a3.6 3.6 0 0 1 7.2 0v4z' }],
    ['path', { d: 'M6.8 14.1a1.3 1.3 0 0 0 2.4 0' }],
    ['path', { d: 'M8 4.8V3.2' }],
  ],
  bolt: [
    ['path', { d: 'M9 1.8L4 9h3.3l-.6 5.2L12 7h-3.3z' }],
  ],
  shield: [
    ['path', { d: 'M8 2.1l5.5 2.1v4c0 2.8-2.3 5-5.5 6-3.2-1-5.5-3.2-5.5-6v-4z' }],
    ['path', { d: 'M5.9 8l1.5 1.5L10.3 6.6' }],
  ],
  globe: [
    ['circle', { cx: 8, cy: 8, r: 5.8 }],
    ['ellipse', { cx: 8, cy: 8, rx: 2.6, ry: 5.8 }],
    ['path', { d: 'M2.2 8h11.6' }],
  ],
  database: [
    ['ellipse', { cx: 8, cy: 4.4, rx: 5.3, ry: 2 }],
    ['path', { d: 'M2.7 4.4v7c0 1.1 2.4 2 5.3 2s5.3-.9 5.3-2v-7' }],
    ['path', { d: 'M2.7 7.9c0 1.1 2.4 2 5.3 2s5.3-.9 5.3-2' }],
  ],
  box: [
    ['path', { d: 'M8 1.8l5.7 3v6.4L8 14.2l-5.7-3V4.8z' }],
    ['path', { d: 'M2.3 4.8L8 7.8l5.7-3M8 7.8v6.4' }],
  ],
  wrench: [
    ['path', { d: 'M10.1 2.2a3.6 3.6 0 0 0-4.7 4.6l-3.9 3.9a1.4 1.4 0 0 0 2 2l3.9-3.9a3.6 3.6 0 0 0 4.6-4.7l-2.1 2.1-1.9-.6-.6-1.9z' }],
  ],
  layers: [
    ['path', { d: 'M8 1.8l5.7 3L8 7.8 2.3 4.8z' }],
    ['path', { d: 'M2.3 8.2L8 11.2l5.7-3' }],
    ['path', { d: 'M2.3 11.4L8 14.4l5.7-3' }],
  ],
  compass: [
    ['circle', { cx: 8, cy: 8, r: 5.8 }],
    ['path', { d: 'M10.4 5.6L8.8 8.8 5.6 10.4l1.6-3.2z' }],
  ],
  chat: [
    ['path', { d: 'M2.2 7.6c0-2.7 2.6-4.9 5.8-4.9s5.8 2.2 5.8 4.9-2.6 4.9-5.8 4.9c-.7 0-1.4-.1-2-.3l-2.9 1.2.9-2.5a4.7 4.7 0 0 1-1.8-3.3z' }],
  ],
  home: [
    ['path', { d: 'M2.6 7.4L8 2.6l5.4 4.8' }],
    ['path', { d: 'M4 6.8v6.6h8V6.8' }],
    ['path', { d: 'M6.5 13.4V9.8h3v3.6' }],
  ],
}

/** 已注册的图标名（与配置校验共用一份名单）。 */
const ICON_NAMES = BUILTIN_ICONS

/**
 * 渲染一个内置图标。
 * @param {{ name?: string, size?: number, active?: boolean, className?: string }} props
 */
function Glyph({ name, size = 16, active = false, className }) {
  const shapes = SHAPES[name] ?? SHAPES.grid
  return h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.25,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
      className,
      'data-railkeeper-glyph': name ?? 'grid',
      ...(active ? { 'data-railkeeper-glyph-active': '' } : {}),
    },
    shapes.map(([tag, attrs], index) => {
      const filled = attrs.filled === true
      const { filled: _filled, ...rest } = attrs
      return h(tag, {
        key: `${name ?? 'grid'}-${index}`,
        ...rest,
        ...(filled ? { fill: 'currentColor', stroke: 'none' } : {}),
      })
    }),
  )
}

/**
 * 给 CSS/图标选择器用的 data URI（黑稿，靠 mask 或 img 着色）。
 * @param {string} name
 */
function glyphDataUri(name) {
  const shapes = SHAPES[name] ?? SHAPES.grid
  const body = shapes.map(([tag, attrs]) => {
    const clean = Object.entries(attrs)
      .filter(([key]) => key !== 'filled')
      .map(([key, value]) => `${key}="${String(value)}"`)
      .join(' ')
    const fill = attrs.filled === true ? ' fill="black" stroke="none"' : ''
    return `<${tag} ${clean}${fill}/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
  __rkExports["ICON_NAMES"] = ICON_NAMES;
  __rkExports["Glyph"] = Glyph;
  __rkExports["glyphDataUri"] = glyphDataUri;
  return Object.freeze(__rkExports);
})();

// ---- src/client/menu.js ----
const __rkm4 = (() => {
  const __rkExports = {};
/**
 * dsh-railkeeper —— 弹出菜单的摆放计算（纯函数）。
 *
 * 分组行点开后要在它旁边弹一个成员列表。菜单尺寸和触发元素的位置都只有运行时
 * 才知道，所以这里只做一件事：给定两者的矩形和视口大小，算出左上角坐标，
 * 保证菜单不越出视口。抽成纯函数是因为这部分最容易算错（贴边、翻转），
 * 而且不需要浏览器就能测。
 */

/** 菜单与触发元素之间的间距。 */
const MENU_GAP = 6
/** 菜单距视口边缘的最小留白。 */
const MENU_MARGIN = 8

/**
 * @typedef {{ top: number, left: number, width: number, height: number }} Rect
 * @typedef {{ width: number, height: number }} Size
 */

/**
 * 计算菜单的固定定位坐标。
 *
 * 水平方向：优先放在触发元素右侧（侧栏在左，向右弹不挡轨道）；
 * 右侧放不下就翻到左侧；两侧都放不下就贴视口左边。
 * 垂直方向：默认与触发元素上边缘对齐，下方空间不足时向上收，最后夹进视口。
 *
 * @param {Rect} anchor 触发元素的视口矩形
 * @param {Size} menu 菜单自身尺寸
 * @param {Size} viewport 视口尺寸
 * @returns {{ top: number, left: number, flippedX: boolean, flippedY: boolean }}
 */
function placeMenu(anchor, menu, viewport) {
  const rightRoom = viewport.width - (anchor.left + anchor.width) - MENU_GAP - MENU_MARGIN
  const leftRoom = anchor.left - MENU_GAP - MENU_MARGIN
  let flippedX = false
  let left
  if (rightRoom >= menu.width) {
    left = anchor.left + anchor.width + MENU_GAP
  } else if (leftRoom >= menu.width) {
    left = anchor.left - MENU_GAP - menu.width
    flippedX = true
  } else {
    // 两侧都放不下：贴着视口左边，至少保证整条菜单可见
    left = MENU_MARGIN
  }
  left = clamp(left, MENU_MARGIN, Math.max(MENU_MARGIN, viewport.width - menu.width - MENU_MARGIN))

  const belowRoom = viewport.height - anchor.top - MENU_MARGIN
  let flippedY = false
  let top = anchor.top
  if (belowRoom < menu.height && anchor.top + anchor.height > menu.height + MENU_MARGIN) {
    // 向上翻转：菜单底边与触发元素底边对齐
    top = anchor.top + anchor.height - menu.height
    flippedY = true
  }
  top = clamp(top, MENU_MARGIN, Math.max(MENU_MARGIN, viewport.height - menu.height - MENU_MARGIN))

  return { top, left, flippedX, flippedY }
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

  __rkExports["MENU_GAP"] = MENU_GAP;
  __rkExports["MENU_MARGIN"] = MENU_MARGIN;
  __rkExports["placeMenu"] = placeMenu;
  return Object.freeze(__rkExports);
})();

// ---- src/client/model.js ----
const __rkm5 = (() => {
  const __rkExports = {};
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
const { cloneConfig, createGroupId, defaultConfig } = __rkm2;

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
function materialize(config, live) {
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
function buildPlan(config, live) {
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
function rowIndex(config, rowId) {
  return config.sequence.findIndex((row) => row.id === rowId)
}

/**
 * 把某一行移动 delta 步（负数为上移）。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {Array<{ id: string, order: number, label: string }>} live
 * @param {string} rowId
 * @param {number} delta
 */
function moveRow(config, live, rowId, delta) {
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
function moveRowBefore(config, live, rowId, targetId) {
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
function groupPanels(config, live, ids) {
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
function ungroup(config, groupId) {
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
function removeMember(config, groupId, memberId) {
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
function removePanelRow(config, panelId) {
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
function setPanelField(config, panelId, field, value) {
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
function setGroupField(config, groupId, field, value) {
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
function clearPanelOverride(config, panelId) {
  const next = cloneConfig(config)
  delete next.panels[panelId]
  return next
}

/**
 * 清空分组自己的外观覆盖（名称/图标/隐藏），保留成员。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {string} groupId
 */
function clearGroupOverride(config, groupId) {
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
function findGroup(config, groupId) {
  return config.sequence.find((row) => row.type === 'group' && row.id === groupId)
}

/**
 * 配置里出现、但当前 live 中不存在的面板 id。
 * @param {ReturnType<typeof defaultConfig>} config
 * @param {Array<{ id: string }>} live
 */
function findOrphans(config, live) {
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
  __rkExports["materialize"] = materialize;
  __rkExports["buildPlan"] = buildPlan;
  __rkExports["rowIndex"] = rowIndex;
  __rkExports["moveRow"] = moveRow;
  __rkExports["moveRowBefore"] = moveRowBefore;
  __rkExports["groupPanels"] = groupPanels;
  __rkExports["ungroup"] = ungroup;
  __rkExports["removeMember"] = removeMember;
  __rkExports["removePanelRow"] = removePanelRow;
  __rkExports["setPanelField"] = setPanelField;
  __rkExports["setGroupField"] = setGroupField;
  __rkExports["clearPanelOverride"] = clearPanelOverride;
  __rkExports["clearGroupOverride"] = clearGroupOverride;
  __rkExports["findGroup"] = findGroup;
  __rkExports["findOrphans"] = findOrphans;
  return Object.freeze(__rkExports);
})();

// ---- src/client/shadow.js ----
const __rkm6 = (() => {
  const __rkExports = {};
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
const SHADOW_PRIORITY_STEP = 1

/**
 * 某格「如果没有本插件时会渲染的组件」所在的原生条目。
 *
 * 取注册表顺序里的第一个：内核已按 priority、order 排好序，第一个就是原生赢家。
 * 这样插件市场套在 `plugins` 上的更新角标会被我们包在里面，角标不丢。
 *
 * @param {string} id
 * @param {Array<{ options: { id?: string, priority?: number } }>} natives
 */
function sourceEntryFor(id, natives) {
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
function shadowPriorityFor(id, natives) {
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
function shadowSignature(state) {
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
function planShadows(plan, overrides, natives) {
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
function diffShadows(current, wanted) {
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
  __rkExports["SHADOW_PRIORITY_STEP"] = SHADOW_PRIORITY_STEP;
  __rkExports["sourceEntryFor"] = sourceEntryFor;
  __rkExports["shadowPriorityFor"] = shadowPriorityFor;
  __rkExports["shadowSignature"] = shadowSignature;
  __rkExports["planShadows"] = planShadows;
  __rkExports["diffShadows"] = diffShadows;
  return Object.freeze(__rkExports);
})();

// ---- src/client/rail.js ----
const __rkm7 = (() => {
  const __rkExports = {};
/**
 * dsh-railkeeper —— 左侧栏运行时。
 *
 * 做的事：
 * 1. 读 `sidebar.panellist` 的注册表，记下每个面板的原生 order/label/component；
 * 2. 按配置算出计划，为需要改动的面板**注册自己的遮蔽条目**（同 id、更低 priority），
 *    由包裹组件负责「隐藏」标记与自定义图标；
 * 3. 分组行：额外注册一条 `sidebar.panellist` 条目 + 同 key 的 `main` 页面；
 * 4. 用一段由本插件拥有的样式把带标记的整行隐藏。
 *
 * 为什么是「遮蔽」而不是「原地改写」：
 *
 * 早期版本直接改别的插件注册条目上的 order/label/component。槽位注册表里那些
 * options 是普通对象，改它不产生通知，于是当时靠「注册一个临时条目再释放」
 * 去推一帧。但只要有第二个插件也在观察同一个槽位（典型是插件市场，它会给
 * `plugins` 这一格套一层更新角标，并且自己也在监听 `sidebar.panellist`），
 * 两边就会互相触发：我们改 → 它重注册 → 槽位通知 → 我们再改……这条链全在
 * 微任务里，事件循环没有机会让出，界面直接卡死（用户看到的就是「点合并就卡住」）。
 *
 * 现在改成注册自己的条目：注册表按 priority 遮蔽，我们的条目只是「多出来的一层」，
 * 不碰别人的对象，别人的 reconcile 看到条目数变了会自己收手，两边一次收敛。
 * 卸载时只需要 dispose 自己的条目，不必回滚别人的字段，也不会再有代际竞态。
 */
const React = __rkRequire("react");
const ReactDOM = __rkRequire("react-dom");
const { GROUP_ENTRY_PREFIX, RAIL_ENTRY_PREFIX } = __rkm2;
const { Glyph } = __rkm3;
const { placeMenu } = __rkm4;
const { buildPlan } = __rkm5;
const { diffShadows, planShadows } = __rkm6;

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

/**
 * 是否允许自检真的切换面板。
 *
 * 自检要回答的问题是「点分组菜单里的成员，会不会切过去」——唯一的验证办法就是
 * 真的切一次再切回来。但 `layout.selectPanel()` 会 `abort()` 当前导航并立刻提交
 * 一次状态，中间那一帧是用户真能看见的：侧栏那一行（以及它所属的分组行）会闪
 * 一下选中态。曾经以为「两次变更在同一个 tick 里、React 会合并」就看不见，这个
 * 假设是错的——订阅者会在 abort 时同步响应，帧照常提交。
 *
 * 所以默认**不跑**：生产环境里为了诊断而真实操作用户的应用，代价太大。
 * 需要排查时用 `localStorage['dsh-railkeeper.probe'] = '1'` 打开后重载，
 * 或直接用设置页的「跑一次自检」按钮。
 */
const PROBE_FLAG = 'dsh-railkeeper.probe'

/** 自检开关：默认关。 */
function probeEnabled() {
  try {
    if (typeof window !== 'undefined' && window.localStorage?.getItem(PROBE_FLAG) === '1') return true
  } catch {
    // 隐私模式读不到 localStorage，按关闭处理
  }
  try {
    return typeof navigator !== 'undefined' && navigator.userAgent.includes('RailkeeperProbe')
  } catch {
    return false
  }
}

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
function createRailController({ ctx, store, i18n, api, version }) {
  let started = false
  let disposed = false
  let applying = false
  let scheduled = false
  let snapshotVersion = 0
  let lastReportAt = 0
  /**
   * 本插件注册的「遮蔽条目」。
   *
   * 每条记录带一份签名：order、自定义名称、图标、隐藏状态，以及被包裹组件的身份。
   * 签名不变就不重新注册——这是收敛的唯一保证。早期版本没有这一层，于是每次
   * 槽位通知都重写一遍，和别的观察者形成无界微任务链。
   * @type {Map<string, { dispose: () => void, signature: string, priority: number }>}
   */
  const shadows = new Map()
  /** 我们自己的包裹组件：用来把「我们注册的条目」从原生条目里区分出来。 */
  const ownWrappers = new Set()
  /** 原生条目的 label / component 快照（设置页预览、回退名称用）。 */
  const nativeLabels = new Map()
  const nativeComponents = new Map()
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
  /** 上一次检测到的「被别的插件盖住」的面板 id。 */
  let overshadowed = []

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

  /**
   * 槽位里的全部条目（含被遮蔽的）。
   *
   * `entries()` 是新内核才有的；老内核只有 `entriesOfSlot()`（每格只给赢家）。
   * 没有 `entries()` 时退化成赢家列表：遮蔽仍能工作，只是看不到被盖住的那份。
   */
  function allEntries() {
    try {
      if (typeof ctx.slots.entries === 'function') {
        return ctx.slots.entries('sidebar.panellist') ?? []
      }
      return ctx.slots.entriesOfSlot('sidebar.panellist') ?? []
    } catch {
      return []
    }
  }

  /** @param {any} entry */
  function isOwnEntry(entry) {
    return entry !== undefined && entry !== null && ownWrappers.has(entry.component)
  }

  /**
   * 其它插件注册的面板条目（不含本插件自己的遮蔽条目与分组行）。
   * @param {any[]} [source]
   */
  function nativeEntries(source) {
    const entries = source ?? allEntries()
    return entries.filter((entry) => {
      const id = entry?.options?.id
      if (typeof id !== 'string') return false
      if (id.startsWith(RAIL_ENTRY_PREFIX)) return false
      return !isOwnEntry(entry)
    })
  }

  /**
   * 把条目投影成 live 面板列表（按 order、再按注册顺序）。
   *
   * 同一 id 可能有多条：插件市场会给 `plugins` 再注册一层更新角标。注册表已按
   * priority 排好序，第一条就是真正渲染的那个——后面的必须丢掉，否则同一个面板
   * 会被数成两行，顺序比较也永远判成「变了」，遮蔽条目于是反复重注册。
   * @param {any[]} entries
   */
  function livePanels(entries) {
    const seen = new Set()
    return entries
      .map((entry, index) => ({
        id: entry.options.id,
        order: typeof entry.options.order === 'number' ? entry.options.order : index,
        label: resolveLabel(entry.options.label) ?? entry.options.id,
        index,
      }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .filter((item) => {
        if (typeof item.id !== 'string' || seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
      .map(({ id, order, label }) => ({ id, order, label }))
  }

  /**
   * 生成一个面板图标包裹组件：标记 + 自定义图标或原生图标。
   *
   * 被包裹的组件**在渲染时才解析**（`nativeSourceOf`），不在这里捕获：
   * 插件市场会给同一格加一层更新角标、之后又可能撤掉，把组件钉死在注册那一刻
   * 就会要么丢掉角标、要么逼着签名跟着变、要么两边反复重注册。惰性解析之后，
   * 无论那一格的原生赢家换成谁，我们这一条都不需要重注册。
   * @param {string} id
   */
  function makeWrapper(id) {
    const wrapper = function RailkeeperIcon(props) {
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
      const Source = nativeSourceOf(id)
      return h(React.Fragment, null, marker, Source === null ? null : h(Source, props))
    }
    ownWrappers.add(wrapper)
    return wrapper
  }

  /**
   * 某一格此刻的原生赢家组件（不含本插件自己的条目）。
   *
   * 每次渲染现读注册表：别人换组件、加装饰、撤装饰都能立刻反映出来，而我们的
   * 遮蔽条目一直不用动。
   * @param {string} id
   */
  function nativeSourceOf(id) {
    for (const entry of allEntries()) {
      if (entry?.options?.id !== id) continue
      if (isOwnEntry(entry)) continue
      return entry.component ?? null
    }
    return null
  }

  /**
   * 遮蔽条目的名称：用户改过的名字优先，否则沿用原生名称。
   * @param {string} id
   */
  function shadowLabel(id) {
    return () => {
      const override = store.getSnapshot().config.panels?.[id]
      if (typeof override?.label === 'string' && override.label.length > 0) return override.label
      return nativeLabels.get(id) ?? id
    }
  }

  /** 释放某个面板的遮蔽条目。 */
  function disposeShadow(id) {
    const shadow = shadows.get(id)
    if (shadow === undefined) return
    shadows.delete(id)
    try {
      shadow.dispose()
    } catch {
      // ignore
    }
  }

  /**
   * 按计划同步遮蔽条目。
   *
   * 只做三件事：多余的要释放、缺的要注册、签名变了的要重注册。签名没变一律不碰——
   * 这是本插件与其它槽位观察者能收敛的关键。判断本身在 shadow.js 里，纯函数，
   * 有专门的回归测试（「两个插件共存时有界」）。
   * @param {ReturnType<typeof buildPlan>} nextPlan
   * @param {any[]} natives
   */
  function syncShadows(nextPlan, natives) {
    const wanted = planShadows(nextPlan, store.getSnapshot().config.panels, natives)
    const { dispose, register } = diffShadows(shadows, wanted)
    for (const id of dispose) disposeShadow(id)
    for (const id of register) {
      const target = wanted.get(id)
      if (target === undefined) continue
      const wrapper = makeWrapper(id)
      let off
      try {
        off = ctx.slots.register({
          name: 'sidebar.panellist',
          id,
          order: target.order,
          priority: target.priority,
          label: shadowLabel(id),
        }, wrapper)
      } catch {
        // 注册被拒（同名同 priority 已存在等）：这一格保持原样，不影响其它面板。
        ownWrappers.delete(wrapper)
        continue
      }
      shadows.set(id, {
        dispose: typeof off === 'function' ? off : () => {},
        signature: target.signature,
        priority: target.priority,
      })
    }
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
    const Original = nativeComponents.get(id)
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

  /**
   * 排一次「渲染落定后」的上报。
   *
   * rebuild() 注册条目只是把通知排进队列，React 还没提交；此刻量 DOM 只能
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
    const all = allEntries()
    const natives = nativeEntries(all)
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
      // 原生条目（别人的）与我们自己的遮蔽条目分开报，一眼能看出收敛状态。
      live: natives.map((entry) => entry.options.id),
      shadowed: [...shadows.keys()],
      shadowCount: shadows.size,
      entries: all.length,
      nativeEntries: natives.length,
      ledgerOrders: natives.map((entry) => `${entry.options.id}=${String(entry.options.order)}`),
      appliedOrders: [...shadows.entries()].map(([id, shadow]) => `${id}@p${shadow.priority}`),
      // 我们的条目被别的插件用更低 priority 盖住时记在这里（正常应为空）。
      overshadowed,
      planRows: plan.rows.map((row) => `${row.kind}:${row.id}@${row.order}`),
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

  /** 自检未开启时，把「没跑」这件事明确记下来，免得和「跑了但失败」混在一起。 */
  function markProbeSkipped() {
    if (selectProbe === null) selectProbe = { skipped: 'probe-disabled' }
    if (clickProbe === null) clickProbe = { skipped: 'probe-disabled' }
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

  /** 重建计划并同步条目。 */
  function rebuild() {
    if (!started || disposed || applying) return
    applying = true
    try {
      const all = allEntries()
      const natives = nativeEntries(all)
      // 刷新原生快照：名称/组件都取自别人的条目，我们自己从不写它们。
      nativeLabels.clear()
      nativeComponents.clear()
      for (const entry of natives) {
        const id = entry.options.id
        if (!nativeLabels.has(id)) nativeLabels.set(id, resolveLabel(entry.options.label) ?? id)
        if (!nativeComponents.has(id)) nativeComponents.set(id, entry.component)
      }
      const live = livePanels(natives)
      const nextPlan = buildPlan(store.getSnapshot().config, live)
      plan = nextPlan
      syncGroups(nextPlan)
      syncShadows(nextPlan, natives)
      // 被别的插件用更低 priority 盖住的格子：只报告，不抢——抢就会变成对写。
      const winners = new Set()
      try {
        for (const entry of ctx.slots.entriesOfSlot('sidebar.panellist')) winners.add(entry.options.id)
      } catch {
        // ignore
      }
      overshadowed = [...shadows.keys()].filter((id) => !winners.has(id))
      bumpAndNotify()
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
    // 样式只是「隐藏整行」和弹层外观，装不上不该拖垮整个控制器：
    // 顺序、改名、图标、分组都还能工作，只是隐藏退化成不生效。
    // 早期这里直接裸调，一次环境异常（比如极早期的 document）就让 start()
    // 中途抛错，于是后面所有监听和首次重建都不会注册——表现为整个插件「没反应」。
    try {
      ensureStyle()
    } catch (error) {
      layoutNotes.push(`style-failed:${error instanceof Error ? error.message : String(error)}`)
    }
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
        schedule()
        return () => {}
      })
    } catch {
      unsubscribeDeclared = null
    }
    // 自检默认不跑：它会真的切一次面板，用户看得见那一帧闪烁（见 PROBE_FLAG）。
    if (probeEnabled()) {
      setTimeout(() => {
        if (disposed) return
        probeSelect()
        setTimeout(() => {
          if (!disposed) probeMenuClick()
        }, 300)
      }, 1200)
    } else {
      markProbeSkipped()
    }
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
    // 只摘自己的东西：别人的条目从来没被写过，不需要回滚。
    for (const id of [...shadows.keys()]) disposeShadow(id)
    for (const groupId of [...groupDisposers.keys()]) disposeGroup(groupId)
    ownWrappers.clear()
    nativeLabels.clear()
    nativeComponents.clear()
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
      return livePanels(nativeEntries())
    },
    getRailElement() {
      return railElement
    },
    /** 某个面板的原始图标组件（设置页预览用）。 */
    originalComponent(id) {
      return nativeComponents.get(id) ?? null
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
    /**
     * 与另一个左栏管理插件的冲突状态，供设置页显示。
     *
     * 现在的冲突形态只有一种：我们为某格注册的遮蔽条目被对方用更低的 priority
     * 盖住了。这种局面不需要也不应该「抢回来」——抢就是对着写，正是早期卡死的
     * 来源。这里只如实报告，让用户知道该重载或卸掉哪一个。
     */
    getConflict() {
      if (overshadowed.length === 0) return null
      return {
        strikes: 1,
        paused: false,
        panels: [...overshadowed],
        at: new Date().toISOString(),
      }
    },
    /** 用户手动重试：重新算一遍计划并同步。 */
    resume() {
      schedule()
    },
    /**
     * 手动跑一次自检（设置页的「跑一次自检」按钮用）。
     *
     * 明确由用户触发，所以可以真的切面板——这是他要的。跑完把结果放进诊断记录，
     * 界面上会看到侧栏闪一下，属于预期。
     */
    runProbe() {
      if (disposed) return
      probeSelect()
      setTimeout(() => {
        if (!disposed) probeMenuClick()
      }, 300)
    },
  }
}

  __rkExports["createRailController"] = createRailController;
  return Object.freeze(__rkExports);
})();

// ---- src/client/settings.js ----
const __rkm8 = (() => {
  const __rkExports = {};
/**
 * dsh-railkeeper —— 设置页「面板列表」。
 *
 * 一个自包含的 React 组件，注册进 `settings.section`。不引 Harness 的
 * primitives：控件、样式、焦点行为都自己写，避免内核升级时命名导出变化
 * 把整个设置页打崩。
 */
const React = __rkRequire("react");
const { BUILTIN_ICONS } = __rkm2;
const { Glyph } = __rkm3;
const { buildPlan, clearGroupOverride, clearPanelOverride, findOrphans, groupPanels, materialize, moveRow, moveRowBefore, removeMember, removePanelRow, setGroupField, setPanelField, ungroup } = __rkm5;

const h = React.createElement

/**
 * 仓库地址：设置页底部的 star 导流入口指向它。
 *
 * 只此一处，改仓库不用翻代码。`STAR_DISMISS_KEY` 是「以后再说」的本地记忆：
 * 点了就记住，之后不再反复出现——导流最忌讳的就是每次打开设置都糊脸。
 */
const REPO_URL = 'https://github.com/lcy362/dsh-railkeeper'
const STAR_DISMISS_KEY = 'dsh-railkeeper.star-dismissed'

/** 读取「以后再说」的本地记忆；读不到（隐私模式 / 无 localStorage）就当没点过。 */
function readStarDismissed() {
  try {
    return window.localStorage.getItem(STAR_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/** @param {any} store */
function useStore(store) {
  return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/** @param {any} rail */
function useRail(rail) {
  return React.useSyncExternalStore(rail.subscribe, rail.getVersion, rail.getVersion)
}

/** @param {any} i18n */
function useLocale(i18n) {
  return React.useSyncExternalStore(i18n.subscribe, i18n.lang, i18n.lang)
}

/** @param {any} live */
function byIdOf(live) {
  return new Map(live.map((panel) => [panel.id, panel]))
}

function IconButton({ label, title, onClick, disabled, children, active }) {
  return h(
    'button',
    {
      type: 'button',
      className: 'rk-icon-btn',
      'aria-label': label,
      title: title ?? label,
      onClick,
      disabled,
      'aria-pressed': active === undefined ? undefined : active,
    },
    children,
  )
}

function Badge({ children }) {
  return h('span', { className: 'rk-badge' }, children)
}

function IconPicker({ value, onPick, onClear, t }) {
  return h(
    'div',
    { className: 'rk-icons', role: 'group', 'aria-label': t('icon.title') },
    h(
      'button',
      {
        type: 'button',
        className: 'rk-icon-choice rk-icon-choice-text',
        'aria-pressed': value === null,
        onClick: onClear,
      },
      t('actions.originalIcon'),
    ),
    ...BUILTIN_ICONS.map((name) => h(
      'button',
      {
        key: name,
        type: 'button',
        className: 'rk-icon-choice',
        'aria-label': name,
        title: name,
        'aria-pressed': value === name,
        onClick: () => onPick(name),
      },
      h(Glyph, { name, size: 16 }),
    )),
  )
}

/**
 * @param {{
 *   store: any,
 *   rail: any,
 *   i18n: any,
 *   close?: () => void,
 * }} props
 */
function RailkeeperSection({ store, rail, i18n, api, close }) {
  const state = useStore(store)
  useRail(rail)
  useLocale(i18n)
  const t = i18n.t
  const live = rail.getLive()
  const liveIds = new Set(live.map((panel) => panel.id))
  const liveById = byIdOf(live)
  const draft = materialize(state.config, live)
  const plan = buildPlan(state.config, live)
  const [selected, setSelected] = React.useState(() => new Set())
  const [iconEditor, setIconEditor] = React.useState(/** @type {string | null} */ (null))
  const [dragging, setDragging] = React.useState(/** @type {string | null} */ (null))
  const [resetArmed, setResetArmed] = React.useState(false)
  const [openIo, setOpenIo] = React.useState(false)
  const [ioText, setIoText] = React.useState('')
  const [ioArmed, setIoArmed] = React.useState(false)
  const [ioError, setIoError] = React.useState(/** @type {string | null} */ (null))
  const [copied, setCopied] = React.useState(false)
  const [migrateArmed, setMigrateArmed] = React.useState(false)
  const [migrateNote, setMigrateNote] = React.useState(/** @type {string | null} */ (null))
  const ioRef = React.useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const [starDismissed, setStarDismissed] = React.useState(readStarDismissed)
  const [probeArmed, setProbeArmed] = React.useState(false)
  const conflict = rail.getConflict()

  React.useEffect(() => {
    if (!resetArmed) return undefined
    const timer = setTimeout(() => setResetArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [resetArmed])

  React.useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  React.useEffect(() => {
    if (!probeArmed) return undefined
    const timer = setTimeout(() => setProbeArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [probeArmed])

  React.useEffect(() => {
    if (!openIo) return
    setIoText((current) => (current.length > 0 ? current : store.exportJson()))
  }, [openIo, store])

  const selectedLive = [...selected].filter((id) => liveIds.has(id) && isTopLevelPanel(draft, id))

  function isTopLevelPanel(config, id) {
    return config.sequence.some((row) => row.type === 'panel' && row.id === id)
  }

  function toggleSelected(id) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function commitPanelLabel(id, value) {
    const text = value.trim()
    store.update((config) => setPanelField(materialize(config, live), id, 'label', text.length === 0 ? null : text))
  }

  function commitGroupLabel(id, value) {
    const text = value.trim()
    store.update((config) => setGroupField(config, id, 'label', text.length === 0 ? null : text))
  }

  function togglePanelHidden(id, hidden) {
    store.update((config) => setPanelField(materialize(config, live), id, 'hidden', !hidden))
  }

  function toggleGroupHidden(id, hidden) {
    store.update((config) => setGroupField(config, id, 'hidden', !hidden))
  }

  function pickPanelIcon(id, name) {
    setIconEditor(null)
    store.update((config) => setPanelField(materialize(config, live), id, 'icon', name))
  }

  function pickGroupIcon(id, name) {
    setIconEditor(null)
    store.update((config) => setGroupField(config, id, 'icon', name))
  }

  function resetPanel(id) {
    store.update((config) => clearPanelOverride(config, id))
  }

  function resetGroup(id) {
    store.update((config) => clearGroupOverride(config, id))
  }

  function move(id, delta) {
    store.update((config) => moveRow(config, live, id, delta))
  }

  function makeGroup() {
    if (selectedLive.length < 2) return
    store.update((config) => groupPanels(config, live, selectedLive))
    setSelected(new Set())
  }

  function dropOn(targetId) {
    const from = dragging
    setDragging(null)
    if (from === null || from === targetId) return
    store.update((config) => moveRowBefore(config, live, from, targetId))
  }

  function doReset() {
    if (!resetArmed) {
      setResetArmed(true)
      return
    }
    setResetArmed(false)
    void store.reset()
  }

  async function copyJson() {
    const text = ioText.length > 0 ? ioText : store.exportJson()
    setIoText(text)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      ioRef.current?.focus()
      ioRef.current?.select()
    }
  }

  /**
   * 从 dsh-panellist 迁移：拉取旧配置、转换形状、写进本插件。
   * 转换在宿主侧完成（那边才知道文件在哪），这里只负责确认与反馈。
   */
  async function doMigrate() {
    if (!migrateArmed) {
      setMigrateArmed(true)
      setMigrateNote(null)
      return
    }
    setMigrateArmed(false)
    try {
      const result = await api.legacy()
      if (result?.config === undefined || result.config === null) {
        setMigrateNote(t('migrate.none'))
        return
      }
      const applied = store.update(() => result.config)
      if (!applied) {
        setMigrateNote(t('io.invalid', { message: t('migrate.none') }))
        return
      }
      setSelected(new Set())
      const rows = Array.isArray(result.config.sequence) ? result.config.sequence.length : 0
      setMigrateNote(t('migrate.done', { count: rows }))
    } catch (error) {
      setMigrateNote(t('io.invalid', { message: error instanceof Error ? error.message : String(error) }))
    }
  }

  function doImport() {
    setIoError(null)
    if (!ioArmed) {
      setIoArmed(true)
      return
    }
    setIoArmed(false)
    const result = store.importJson(ioText)
    if (!result.ok) {
      setIoError(t('io.invalid', { message: result.message }))
      return
    }
    setSelected(new Set())
    setOpenIo(false)
  }

  const rows = draft.sequence
  const orphanIds = findOrphans(draft, live)
  const statusText = state.saving
    ? t('status.saving')
    : state.status === 'error'
      ? t('error.host')
      : state.dirty
        ? t('status.dirty')
        : t('status.saved')
  const health = state.health ?? {}

  return h(
    'section',
    { className: 'rk-settings', 'aria-label': t('title') },
    h('style', null, CSS),
    h(
      'header',
      { className: 'rk-header' },
      h('h2', { className: 'rk-title' }, t('title')),
      h('p', { className: 'rk-sub' }, t('subtitle')),
    ),
    h(
      'div',
      { className: 'rk-statusbar' },
      h('span', { className: state.error === null ? 'rk-status' : 'rk-status rk-status-err' }, state.error ?? statusText),
      state.dirty || state.status === 'error'
        ? h('button', { type: 'button', className: 'rk-btn', onClick: () => store.retry() }, t('actions.retry'))
        : null,
    ),
    state.status === 'error'
      ? h('p', { className: 'rk-banner' }, t('error.host'))
      : null,
    conflict === null
      ? null
      : h(
        'div',
        { className: 'rk-conflict', role: 'status' },
        h('strong', null, t('conflict.title')),
        h('p', null, t('conflict.body')),
        conflict.panels.length === 0
          ? null
          : h('p', { className: 'rk-conflict-panels' }, t('conflict.panels', { panels: conflict.panels.join(', ') })),
        h('button', {
          type: 'button',
          className: 'rk-btn',
          onClick: () => {
            rail.resume()
            setMigrateNote(null)
          },
        }, t('conflict.resume')),
      ),
    h(
      'div',
      { className: 'rk-toolbar' },
      h('button', {
        type: 'button',
        className: selectedLive.length >= 2 ? 'rk-btn rk-btn-primary' : 'rk-btn',
        disabled: selectedLive.length < 2,
        onClick: makeGroup,
      }, t('actions.group')),
      h('button', {
        type: 'button',
        className: 'rk-btn',
        onClick: () => setSelected(new Set(rows.filter((row) => row.type === 'panel' && liveIds.has(row.id)).map((row) => row.id))),
      }, t('actions.selectAll')),
      selected.size > 0
        ? h('button', { type: 'button', className: 'rk-btn', onClick: () => setSelected(new Set()) }, t('actions.clearSelection'))
        : null,
      h('span', { className: 'rk-toolbar-spacer' }),
      h('button', {
        type: 'button',
        className: probeArmed ? 'rk-btn rk-btn-danger' : 'rk-btn',
        title: t('probe.hint'),
        onClick: () => {
          if (!probeArmed) {
            setProbeArmed(true)
            return
          }
          setProbeArmed(false)
          rail.runProbe?.()
        },
      }, probeArmed ? t('probe.confirm') : t('probe.button')),
      h('button', {
        type: 'button',
        className: resetArmed ? 'rk-btn rk-btn-danger' : 'rk-btn',
        onClick: doReset,
      }, resetArmed ? t('actions.resetConfirm') : t('actions.reset')),
      h('button', {
        type: 'button',
        className: 'rk-btn',
        onClick: () => setOpenIo((value) => !value),
      }, openIo ? t('actions.cancel') : `${t('actions.import')} / ${t('actions.export')}`),
    ),
    h('p', { className: 'rk-hint' }, t('hint.grouping')),
    rows.length === 0
      ? h(
        'div',
        { className: 'rk-empty' },
        h('strong', null, t('empty.title')),
        h('span', null, t('empty.hint')),
      )
      : h(
        'div',
        { className: 'rk-list', role: 'list' },
        ...rows.map((row, index) => {
          if (row.type === 'group') {
            return renderGroup(row, index)
          }
          return renderPanel(row, index)
        }),
      ),
    h('p', { className: 'rk-hint' }, t('hint.drag')),
    orphanIds.length === 0 ? null : h(
      'section',
      { className: 'rk-orphans' },
      h('h3', { className: 'rk-subtitle' }, t('orphans.title')),
      h('p', { className: 'rk-hint' }, t('orphans.hint')),
      ...orphanIds.map((id) => {
        const owner = orphanOwner(draft, id)
        return h(
          'div',
          { className: 'rk-row rk-row-orphan', key: `orphan-${id}` },
          h('span', { className: 'rk-dot' }),
          h('span', { className: 'rk-name-text' }, id),
          h('span', { className: 'rk-badge' }, t('row.missing')),
          h('span', { className: 'rk-toolbar-spacer' }),
          h('button', {
            type: 'button',
            className: 'rk-btn',
            onClick: () => {
              if (owner?.kind === 'member') {
                store.update((config) => removeMember(config, owner.groupId, id))
              } else {
                store.update((config) => removePanelRow(config, id))
              }
              setSelected((current) => {
                const next = new Set(current)
                next.delete(id)
                return next
              })
            },
          }, t('actions.remove')),
        )
      }),
    ),
    openIo
      ? h(
        'section',
        { className: 'rk-io' },
        h('h3', { className: 'rk-subtitle' }, t('io.title')),
        h('p', { className: 'rk-hint' }, t('io.hint')),
        h('textarea', {
          ref: ioRef,
          className: 'rk-textarea',
          value: ioText,
          spellCheck: false,
          placeholder: t('io.placeholder'),
          onChange: (event) => {
            setIoText(event.target.value)
            setIoArmed(false)
          },
        }),
        ioError === null ? null : h('p', { className: 'rk-error' }, ioError),
        migrateNote === null ? null : h('p', { className: 'rk-hint' }, migrateNote),
        h(
          'div',
          { className: 'rk-toolbar' },
          h('button', { type: 'button', className: 'rk-btn', onClick: doMigrate }, migrateArmed ? t('migrate.confirm') : t('migrate.button')),
          h('button', { type: 'button', className: 'rk-btn', onClick: () => setIoText(store.exportJson()) }, t('actions.export')),
          h('button', { type: 'button', className: 'rk-btn', onClick: copyJson }, copied ? t('actions.copied') : t('actions.copy')),
          h('span', { className: 'rk-toolbar-spacer' }),
          h('button', {
            type: 'button',
            className: ioArmed ? 'rk-btn rk-btn-danger' : 'rk-btn rk-btn-primary',
            onClick: doImport,
          }, ioArmed ? t('io.confirm') : t('io.import')),
        ),
      )
      : null,
    starDismissed ? null : h(
      'section',
      { className: 'rk-star' },
      h(
        'div',
        { className: 'rk-star-body' },
        h('strong', { className: 'rk-star-title' }, t('star.title')),
        h('p', { className: 'rk-star-text' }, t('star.body')),
      ),
      h(
        'div',
        { className: 'rk-star-actions' },
        h('button', {
          type: 'button',
          className: 'rk-btn rk-btn-primary',
          onClick: () => {
            try {
              window.open(REPO_URL, '_blank', 'noopener,noreferrer')
            } catch {
              // 打不开就退化成普通链接，见下面的 fallback
            }
          },
        }, t('star.action')),
        h('button', {
          type: 'button',
          className: 'rk-btn',
          onClick: () => {
            setStarDismissed(true)
            try {
              window.localStorage.setItem(STAR_DISMISS_KEY, '1')
            } catch {
              // 记不住就只是这次不再显示，不影响其它功能
            }
          },
        }, t('star.dismiss')),
      ),
      // 兜底：某些环境里 window.open 被拦，留一个真链接可点（也方便右键复制）。
      h('a', {
        className: 'rk-star-link',
        href: REPO_URL,
        target: '_blank',
        rel: 'noreferrer',
      }, REPO_URL),
    ),
    h(
      'footer',
      { className: 'rk-footer' },
      h('span', null, t('footer.profile', { profile: state.profileId || health.profileId || '—' })),
      typeof health.configPath === 'string' ? h('span', null, t('footer.path', { path: health.configPath })) : null,
    ),
  )

  function renderPanel(row, index) {
    const id = row.id
    const panel = liveById.get(id)
    const missing = panel === undefined
    const override = state.config.panels?.[id] ?? {}
    const displayName = override.label ?? panel?.label ?? id
    const icon = typeof override.icon === 'string' ? override.icon : null
    const hidden = override.hidden === true
    const isSelected = selected.has(id)
    const isEditing = iconEditor === id
    return h(
      'div',
      { key: id, className: 'rk-row-block', role: 'listitem' },
      h(
        'div',
        {
          className: `rk-row${dragging === id ? ' rk-row-dragging' : ''}`,
          draggable: !missing,
          onDragStart: (event) => {
            setDragging(id)
            event.dataTransfer.effectAllowed = 'move'
            try {
              event.dataTransfer.setData('text/plain', id)
            } catch {
              // some WebViews restrict dataTransfer
            }
          },
          onDragEnd: () => setDragging(null),
          onDragOver: (event) => {
            if (dragging !== null && dragging !== id) event.preventDefault()
          },
          onDrop: (event) => {
            event.preventDefault()
            dropOn(id)
          },
        },
        h('button', {
          type: 'button',
          className: 'rk-handle',
          title: t('row.drag'),
          'aria-label': t('row.drag'),
          disabled: missing,
        }, '⠿'),
        h('input', {
          type: 'checkbox',
          className: 'rk-check',
          checked: isSelected,
          disabled: missing,
          'aria-label': t('actions.select'),
          onChange: () => toggleSelected(id),
        }),
        h(IconButton, {
          label: t('icon.title'),
          onClick: () => setIconEditor(isEditing ? null : id),
          disabled: missing,
        }, icon === null
          ? h(PanelGlyph, { id, size: 16 })
          : h(Glyph, { name: icon, size: 16 })),
        h('input', {
          className: 'rk-name',
          defaultValue: displayName,
          key: `${id}:${displayName}`,
          disabled: missing,
          placeholder: t('name.panelPlaceholder'),
          'aria-label': t('name.panelPlaceholder'),
          onBlur: (event) => commitPanelLabel(id, event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              event.currentTarget.value = displayName
              event.currentTarget.blur()
            }
          },
        }),
        h(
          'span',
          { className: 'rk-badges' },
          missing ? h(Badge, null, t('row.missing')) : null,
          !missing && hidden ? h(Badge, null, t('badge.hidden')) : null,
          !missing && override.label !== undefined ? h(Badge, null, t('badge.customLabel')) : null,
          !missing && override.icon !== undefined ? h(Badge, null, t('badge.customIcon')) : null,
        ),
        h(
          'span',
          { className: 'rk-row-actions' },
          h(IconButton, {
            label: hidden ? t('actions.show') : t('actions.hide'),
            onClick: () => togglePanelHidden(id, hidden),
            disabled: missing,
            active: hidden,
          }, hidden ? '◌' : '●'),
          h(IconButton, { label: t('actions.up'), disabled: index === 0, onClick: () => move(id, -1) }, '↑'),
          h(IconButton, { label: t('actions.down'), disabled: index === rows.length - 1, onClick: () => move(id, 1) }, '↓'),
          override.label !== undefined || override.icon !== undefined || override.hidden === true
            ? h(IconButton, { label: t('actions.clearOverride'), onClick: () => resetPanel(id) }, '↺')
            : null,
        ),
      ),
      isEditing
        ? h(IconPicker, {
          value: icon,
          t,
          onPick: (name) => pickPanelIcon(id, name),
          onClear: () => pickPanelIcon(id, null),
        })
        : null,
    )
  }

  function renderGroup(row, index) {
    const id = row.id
    const group = plan.groups.get(id)
    const displayName = row.label ?? t('group.defaultName')
    const icon = typeof row.icon === 'string' ? row.icon : null
    const hidden = row.hidden === true
    const isEditing = iconEditor === id
    return h(
      'div',
      { key: id, className: 'rk-row-block rk-row-block-group', role: 'listitem' },
      h(
        'div',
        {
          className: `rk-row rk-row-group${dragging === id ? ' rk-row-dragging' : ''}`,
          draggable: true,
          onDragStart: (event) => {
            setDragging(id)
            event.dataTransfer.effectAllowed = 'move'
            try {
              event.dataTransfer.setData('text/plain', id)
            } catch {
              // ignore
            }
          },
          onDragEnd: () => setDragging(null),
          onDragOver: (event) => {
            if (dragging !== null && dragging !== id) event.preventDefault()
          },
          onDrop: (event) => {
            event.preventDefault()
            dropOn(id)
          },
        },
        h('button', { type: 'button', className: 'rk-handle', 'aria-label': t('row.drag'), title: t('row.drag') }, '⠿'),
        h('span', { className: 'rk-check-spacer' }),
        h(IconButton, {
          label: t('icon.title'),
          onClick: () => setIconEditor(isEditing ? null : id),
        }, h(Glyph, { name: icon ?? 'layers', size: 16 })),
        h('input', {
          className: 'rk-name',
          defaultValue: displayName,
          key: `${id}:${displayName}`,
          placeholder: t('name.groupPlaceholder'),
          'aria-label': t('name.groupPlaceholder'),
          onBlur: (event) => commitGroupLabel(id, event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              event.currentTarget.value = displayName
              event.currentTarget.blur()
            }
          },
        }),
        h(
          'span',
          { className: 'rk-badges' },
          h(Badge, null, t('row.memberCount', { count: group?.members.length ?? row.members.length })),
          hidden ? h(Badge, null, t('badge.hidden')) : null,
        ),
        h(
          'span',
          { className: 'rk-row-actions' },
          h(IconButton, {
            label: hidden ? t('actions.show') : t('actions.hide'),
            onClick: () => toggleGroupHidden(id, hidden),
            active: hidden,
          }, hidden ? '◌' : '●'),
          h(IconButton, { label: t('actions.up'), disabled: index === 0, onClick: () => move(id, -1) }, '↑'),
          h(IconButton, { label: t('actions.down'), disabled: index === rows.length - 1, onClick: () => move(id, 1) }, '↓'),
          h(IconButton, {
            label: t('actions.ungroup'),
            onClick: () => store.update((config) => ungroup(config, id)),
          }, '⇲'),
          h(IconButton, { label: t('actions.clearOverride'), onClick: () => resetGroup(id) }, '↺'),
        ),
      ),
      isEditing
        ? h(IconPicker, {
          value: icon,
          t,
          onPick: (name) => pickGroupIcon(id, name),
          onClear: () => pickGroupIcon(id, null),
        })
        : null,
      h(
        'div',
        { className: 'rk-members' },
        ...row.members.map((memberId) => {
          const panel = liveById.get(memberId)
          const memberLabel = state.config.panels?.[memberId]?.label ?? panel?.label ?? memberId
          return h(
            'div',
            { className: `rk-member${panel === undefined ? ' rk-member-missing' : ''}`, key: `${id}:${memberId}` },
            h(PanelGlyph, { id: memberId, size: 14 }),
            h('span', { className: 'rk-member-name' }, memberLabel),
            panel === undefined ? h('span', { className: 'rk-badge' }, t('row.missing')) : null,
            h('button', {
              type: 'button',
              className: 'rk-link',
              onClick: () => store.update((config) => removeMember(config, id, memberId)),
            }, t('actions.removeFromGroup')),
          )
        }),
      ),
    )
  }
}

/** 图标预览：优先配置图标，否则渲染原始组件。 */
function PanelGlyph({ id, size }) {
  const rail = useRailContext()
  const state = rail.plan.panels.get(id)
  if (state !== undefined && typeof state.icon === 'string' && state.icon.length > 0) {
    return h(Glyph, { name: state.icon, size })
  }
  const Original = rail.original(id)
  if (Original === undefined || Original === null) return h(Glyph, { name: 'grid', size })
  return h(Original, { size, active: false })
}

/**
 * 找到某个未安装面板在配置里的归属：顶层行，还是某个分组。
 * @param {any} config
 * @param {string} id
 */
function orphanOwner(config, id) {
  for (const row of config.sequence) {
    if (row.type === 'panel' && row.id === id) return { kind: 'panel', groupId: null }
    if (row.type === 'group' && row.members.includes(id)) return { kind: 'member', groupId: row.id }
  }
  return null
}

/**
 * PanelGlyph 需要拿到当前 controller 的计划与原始组件。
 * 用 React context 传，避免在设置页里复制一份状态。
 */
const RailContext = React.createContext(/** @type {any} */ (null))

function useRailContext() {
  const value = React.useContext(RailContext)
  if (value === null) throw new Error('railkeeper: missing rail context')
  return value
}

/**
 * 设置页组件工厂：把 controller 包进 context。
 * @param {{ store: any, rail: any, i18n: any }} deps
 */
function createSettingsComponent({ store, rail, i18n, api }) {
  function SettingsSection() {
    return h(
      RailContext.Provider,
      {
        value: {
          get plan() {
            return rail.getPlan()
          },
          original(id) {
            return rail.originalComponent?.(id) ?? null
          },
        },
      },
      h(RailkeeperSection, { store, rail, i18n, api }),
    )
  }
  return SettingsSection
}

/** 与设置页共用的样式；只出现在设置面板内，卸载即移除。 */
const CSS = `
.rk-settings { display: flex; flex-direction: column; gap: 14px; padding: 4px 0 28px; color: var(--dsw-alias-label-primary); }
.rk-header { display: flex; flex-direction: column; gap: 4px; }
.rk-title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600; }
.rk-sub { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.rk-subtitle { margin: 0 0 2px; font-size: 13px; line-height: 20px; font-weight: 600; }
.rk-statusbar { display: flex; align-items: center; gap: 8px; min-height: 20px; }
.rk-status { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.rk-status-err { color: var(--dsw-alias-state-error-primary, #c0392b); }
.rk-banner { margin: 0; padding: 8px 10px; border: 1px solid var(--dsw-alias-separator-primary); border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-bg-layer-2); font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.rk-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rk-toolbar-spacer { flex: 1; }
.rk-btn { height: 28px; padding: 0 10px; box-sizing: border-box; border: 1px solid var(--dsw-alias-separator-primary); border-radius: var(--dsw-radius-sm); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; cursor: pointer; }
.rk-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.rk-btn:disabled { cursor: default; opacity: .5; }
.rk-btn:disabled:hover { background: transparent; }
.rk-btn-primary { background: var(--dsw-alias-state-business-primary); border-color: transparent; color: #fff; }
.rk-btn-primary:hover { filter: brightness(.95); background: var(--dsw-alias-state-business-primary); }
.rk-btn-danger { border-color: var(--dsw-alias-state-error-primary, #c0392b); color: var(--dsw-alias-state-error-primary, #c0392b); }
.rk-hint { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-caption); }
.rk-list { display: flex; flex-direction: column; border: 1px solid var(--dsw-alias-separator-primary); border-radius: var(--dsw-radius-md); overflow: hidden; }
.rk-row { display: flex; align-items: center; gap: 6px; min-height: 42px; padding: 5px 8px; box-sizing: border-box; border-top: 1px solid var(--dsw-alias-separator-primary); }
.rk-row-block:first-child > .rk-row { border-top: none; }
.rk-row-group { background: var(--dsw-alias-bg-layer-2); }
.rk-row-orphan { background: transparent; }
.rk-row-dragging { opacity: .45; }
.rk-handle { flex: none; width: 22px; height: 28px; padding: 0; border: none; background: transparent; color: var(--dsw-alias-label-caption); cursor: grab; font-size: 14px; line-height: 28px; }
.rk-handle:disabled { cursor: default; opacity: .35; }
.rk-check { flex: none; width: 14px; height: 14px; margin: 0 2px; accent-color: var(--dsw-alias-state-business-primary); }
.rk-check-spacer { flex: none; width: 18px; }
.rk-icon-btn { flex: none; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: none; border-radius: var(--dsw-radius-sm); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 12px; cursor: pointer; }
.rk-icon-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.rk-icon-btn:disabled { opacity: .35; cursor: default; }
.rk-icon-btn:disabled:hover { background: transparent; }
.rk-name { flex: 1; min-width: 60px; height: 28px; padding: 0 6px; box-sizing: border-box; border: 1px solid transparent; border-radius: var(--dsw-radius-sm); background: transparent; color: inherit; font: inherit; font-size: 13px; }
.rk-name:hover { border-color: var(--dsw-alias-separator-primary); }
.rk-name:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); background: var(--dsw-alias-bg-layer-2); }
.rk-name:disabled { color: var(--dsw-alias-label-caption); }
.rk-name-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.rk-badges { display: flex; align-items: center; gap: 4px; flex: none; }
.rk-badge { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 18px; white-space: nowrap; }
.rk-row-actions { display: flex; align-items: center; gap: 2px; flex: none; }
.rk-members { display: flex; flex-direction: column; gap: 2px; padding: 0 8px 8px 40px; }
.rk-member { display: flex; align-items: center; gap: 6px; min-height: 28px; padding: 2px 4px; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.rk-member-missing { opacity: .55; }
.rk-member-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rk-link { padding: 2px 4px; border: none; background: transparent; color: var(--dsw-alias-state-business-primary); font: inherit; font-size: 12px; cursor: pointer; }
.rk-link:hover { text-decoration: underline; }
.rk-icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 4px; padding: 8px 10px; border-top: 1px solid var(--dsw-alias-separator-primary); background: var(--dsw-alias-bg-layer-2); }
.rk-icon-choice { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--dsw-radius-sm); background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; }
.rk-icon-choice:hover { background: var(--dsw-alias-interactive-bg-hover); }
.rk-icon-choice[aria-pressed='true'] { border-color: var(--dsw-alias-state-business-primary); color: var(--dsw-alias-state-business-primary); }
.rk-icon-choice-text { width: auto; padding: 0 8px; font: inherit; font-size: 12px; }
.rk-empty { display: flex; flex-direction: column; gap: 4px; padding: 24px 16px; border: 1px dashed var(--dsw-alias-separator-primary); border-radius: var(--dsw-radius-md); text-align: center; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.rk-empty strong { font-size: 13px; color: var(--dsw-alias-label-primary); }
.rk-orphans { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; }
.rk-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-label-caption); flex: none; }
.rk-io { display: flex; flex-direction: column; gap: 8px; }
.rk-textarea { width: 100%; min-height: 150px; padding: 8px; box-sizing: border-box; resize: vertical; border: 1px solid var(--dsw-alias-separator-primary); border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 12px; line-height: 18px; }
.rk-textarea:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); }
.rk-error { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary, #c0392b); }
.rk-conflict { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--dsw-alias-state-warning-primary, #d9a441); border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-bg-layer-2); font-size: 12px; line-height: 18px; }
.rk-conflict strong { font-size: 13px; }
.rk-conflict p { margin: 0; color: var(--dsw-alias-label-secondary); }
.rk-conflict-panels { font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 11px; }
.rk-star { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 12px 14px; box-sizing: border-box; border: 1px solid var(--dsw-alias-separator-primary); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-2); }
.rk-star-body { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 2px; }
.rk-star-title { font-size: 13px; line-height: 20px; }
.rk-star-text { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.rk-star-actions { display: flex; align-items: center; gap: 8px; flex: none; }
.rk-star-link { flex-basis: 100%; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-caption); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rk-star-link:hover { text-decoration: underline; color: var(--dsw-alias-label-secondary); }
.rk-footer { display: flex; flex-direction: column; gap: 2px; padding-top: 6px; border-top: 1px solid var(--dsw-alias-separator-primary); color: var(--dsw-alias-label-caption); font-size: 11px; line-height: 16px; }
`
  __rkExports["RailkeeperSection"] = RailkeeperSection;
  __rkExports["createSettingsComponent"] = createSettingsComponent;
  return Object.freeze(__rkExports);
})();

// ---- src/client/store.js ----
const __rkm9 = (() => {
  const __rkExports = {};
/**
 * dsh-railkeeper —— 浏览器侧配置状态。
 *
 * 单一数据源：`config`。所有编辑先本地生效（乐观更新），再防抖写回宿主；
 * 写失败保留 dirty 状态并给出重试入口，不阻塞界面。
 */
const { defaultConfig, normalizeConfig } = __rkm2;

/**
 * @param {{ load: Function, save: Function, reset: Function }} api
 * @param {{ t: Function }} i18n
 */
function createConfigStore(api, i18n) {
  /** @type {{
   *   status: 'loading' | 'ready' | 'error',
   *   config: ReturnType<typeof defaultConfig>,
   *   profileId: string,
   *   health: Record<string, unknown> | null,
   *   error: string | null,
   *   saving: boolean,
   *   dirty: boolean,
   *   savedAt: number,
   *   revision: number,
   * }} */
  let state = {
    status: 'loading',
    config: defaultConfig(),
    profileId: '',
    health: null,
    error: null,
    saving: false,
    dirty: false,
    savedAt: 0,
    revision: 0,
  }
  const listeners = new Set()
  let saveTimer
  let inFlight = false
  let disposed = false

  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        // a view must not break the store
      }
    }
  }

  /** @param {Partial<typeof state>} patch */
  function set(patch) {
    state = { ...state, ...patch, revision: state.revision + 1 }
    notify()
  }

  function scheduleSave(delay = 450) {
    if (disposed) return
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void saveNow()
    }, delay)
  }

  async function saveNow() {
    if (disposed || inFlight || !state.dirty) return
    inFlight = true
    // 判「这次写入期间又有没有新改动」只能比配置对象本身。
    // 不能用 revision：`set({saving:true})` 自己也会推进它，于是每次保存回来
    // 都会被判成「又脏了」→ 120ms 后再存一次 → 「保存中」永远闪烁、宿主被
    // 每秒七八次写盘。配置每次改动都是一个新对象，身份比较才是真信号。
    const sent = state.config
    set({ saving: true })
    try {
      const result = await api.save(sent)
      if (disposed) return
      const cleaned = normalizeConfig(result?.config)
      const dirty = state.config !== sent
      set({
        status: 'ready',
        // 写入期间又有新改动时保留本地那份：用服务端回包覆盖会把刚敲的东西吃掉。
        config: dirty || !cleaned.ok ? state.config : cleaned.config,
        profileId: typeof result?.profileId === 'string' ? result.profileId : state.profileId,
        health: result?.health ?? state.health,
        saving: false,
        dirty,
        error: null,
        savedAt: Date.now(),
      })
      if (dirty) scheduleSave(120)
    } catch (error) {
      if (disposed) return
      set({
        saving: false,
        dirty: true,
        error: i18n.t('status.error', { message: error instanceof Error ? error.message : String(error) }),
      })
    } finally {
      inFlight = false
    }
  }

  return {
    getSnapshot() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async load() {
      set({ status: 'loading', error: null })
      try {
        const result = await api.load()
        const normalized = normalizeConfig(result?.config)
        set({
          status: 'ready',
          config: normalized.ok ? normalized.config : defaultConfig(),
          profileId: typeof result?.profileId === 'string' ? result.profileId : '',
          health: result?.health ?? null,
          error: normalized.ok ? null : i18n.t('status.error', { message: normalized.errors[0] ?? 'invalid config' }),
          dirty: false,
        })
      } catch (error) {
        set({
          status: 'error',
          error: i18n.t('error.load', { message: error instanceof Error ? error.message : String(error) }),
        })
      }
    },

    /**
     * 从宿主重新读取配置。
     *
     * 用于插件外部改动：手工编辑 railkeeper.json、另一个会话改了配置、
     * 或者窗口从后台回到前台。`dirty` 为真时不覆盖本地未保存的改动，
     * 除非显式 force。
     *
     * @param {{ force?: boolean }} [options]
     * @returns {Promise<boolean>} 是否真的重读了
     */
    async reload(options = {}) {
      if (state.dirty && options.force !== true) return false
      try {
        const result = await api.load()
        const normalized = normalizeConfig(result?.config)
        if (!normalized.ok) return false
        const revision = state.revision
        set({
          status: 'ready',
          config: normalized.config,
          profileId: typeof result?.profileId === 'string' ? result.profileId : state.profileId,
          health: result?.health ?? state.health,
          error: null,
          dirty: false,
        })
        return state.revision !== revision
      } catch {
        // 外部重读失败不改状态：界面上原来的配置仍然有效。
        return false
      }
    },

    /**
     * 以 mutator 的形式更新配置。返回是否接受。
     * @param {(config: ReturnType<typeof defaultConfig>) => ReturnType<typeof defaultConfig>} mutator
     */
    update(mutator) {
      let draft
      try {
        draft = mutator(state.config)
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        return false
      }
      const normalized = normalizeConfig(draft)
      if (!normalized.ok) {
        set({ error: normalized.errors[0] ?? 'invalid config' })
        return false
      }
      set({
        status: state.status === 'loading' ? 'ready' : state.status,
        config: normalized.config,
        dirty: true,
        error: null,
      })
      scheduleSave()
      return true
    },

    /** 立即重试未成功的保存。 */
    retry() {
      if (state.dirty) {
        set({ error: null })
        void saveNow()
      } else {
        void this.load()
      }
    },

    async reset() {
      set({ saving: true })
      try {
        const result = await api.reset()
        const normalized = normalizeConfig(result?.config)
        set({
          status: 'ready',
          config: normalized.ok ? normalized.config : defaultConfig(),
          profileId: typeof result?.profileId === 'string' ? result.profileId : state.profileId,
          health: result?.health ?? state.health,
          saving: false,
          dirty: false,
          error: null,
          savedAt: Date.now(),
        })
      } catch (error) {
        set({
          saving: false,
          error: i18n.t('error.save', { message: error instanceof Error ? error.message : String(error) }),
        })
      }
    },

    /** @param {string} text */
    importJson(text) {
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.profiles !== undefined) {
        parsed = parsed.profiles?.[state.profileId] ?? defaultConfig()
      }
      const normalized = normalizeConfig(parsed)
      if (!normalized.ok) {
        return { ok: false, message: normalized.errors[0] ?? 'invalid config' }
      }
      set({ status: 'ready', config: normalized.config, dirty: true, error: null })
      scheduleSave(0)
      return { ok: true }
    },

    exportJson() {
      return JSON.stringify(state.config, null, 2)
    },

    dispose() {
      disposed = true
      if (saveTimer !== undefined) clearTimeout(saveTimer)
      listeners.clear()
    },
  }
}
  __rkExports["createConfigStore"] = createConfigStore;
  return Object.freeze(__rkExports);
})();

// ---- src/client/index.js ----
const __rkm10 = (() => {
  const __rkExports = {};
/**
 * dsh-railkeeper —— 浏览器半区入口。
 *
 * 只声明 `slots` 一个硬依赖；locale / layout 都按需取，缺了不影响整包加载。
 * 先读宿主配置，再启动侧栏改写，避免先用空配置覆盖一帧顺序。
 */
const { createApi } = __rkm0;
const { createI18n } = __rkm1;
const { createRailController } = __rkm7;
const { createSettingsComponent } = __rkm8;
const { createConfigStore } = __rkm9;

/** 与 package.json 对齐；客户端改动时同步递增后缀，便于从 /client-status 确认现场版本。 */
const CLIENT_VERSION = '0.1.3+client.37'

const name = 'dsh-railkeeper'

/** 只要求 slots；其余服务都走容错读取。 */
const inject = ['slots']

/**
 * @param {any} ctx
 */
function apply(ctx) {
  const api = createApi()
  const i18n = createI18n(ctx)
  const store = createConfigStore(api, i18n)
  const rail = createRailController({ ctx, store, i18n, api, version: CLIENT_VERSION })
  const SettingsSection = createSettingsComponent({ store, rail, i18n, api })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'railkeeper',
    order: 120,
    label: () => i18n.t('section.label'),
  }, SettingsSection))

  ctx.effect(() => () => {
    rail.dispose()
    store.dispose()
    i18n.dispose()
  })

  const announce = (kind) => {
    api.report({
      version: CLIENT_VERSION,
      kind,
      locale: i18n.lang(),
      slots: ['settings.section', 'sidebar.panellist', 'main']
        .filter((slot) => {
          try {
            return ctx.slots.entriesOfSlot(slot).length > 0
          } catch {
            return false
          }
        }),
      hasLayout: (() => {
        try {
          return ctx.get('layout') !== undefined
        } catch {
          return false
        }
      })(),
      // 平台 seed 有没有真的给出 createPortal：弹出菜单能不能挂到 body 全看它
      portalResolved: rail.portalResolved(),
    })
  }

  announce('apply')
  store.load().then(() => {
    rail.start()
    announce('ready')
  }).catch((error) => {
    rail.start()
    api.report({
      version: CLIENT_VERSION,
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  })
}
  __rkExports["CLIENT_VERSION"] = CLIENT_VERSION;
  __rkExports["name"] = name;
  __rkExports["inject"] = inject;
  __rkExports["apply"] = apply;
  return Object.freeze(__rkExports);
})();

    const __rkEntry = __rkm10;
    exports.name = __rkEntry.name;
    exports.inject = __rkEntry.inject;
    exports.apply = __rkEntry.apply;
    return module.exports;
  }
});
