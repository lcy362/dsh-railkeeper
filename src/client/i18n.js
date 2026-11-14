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
export function normalizeLang(value) {
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
export function createI18n(ctx) {
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