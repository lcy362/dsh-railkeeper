/**
 * dsh-railkeeper —— 设置页「面板列表」。
 *
 * 一个自包含的 React 组件，注册进 `settings.section`。不引 Harness 的
 * primitives：控件、样式、焦点行为都自己写，避免内核升级时命名导出变化
 * 把整个设置页打崩。
 */
import * as React from 'react'
import { BUILTIN_ICONS } from '../shared/config.js'
import { Glyph } from './icons.js'
import {
  buildPlan,
  clearGroupOverride,
  clearPanelOverride,
  findOrphans,
  groupPanels,
  materialize,
  moveRow,
  moveRowBefore,
  removeMember,
  removePanelRow,
  setGroupField,
  setPanelField,
  ungroup,
} from './model.js'

const h = React.createElement

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
export function RailkeeperSection({ store, rail, i18n, api, close }) {
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
export function createSettingsComponent({ store, rail, i18n, api }) {
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
.rk-footer { display: flex; flex-direction: column; gap: 2px; padding-top: 6px; border-top: 1px solid var(--dsw-alias-separator-primary); color: var(--dsw-alias-label-caption); font-size: 11px; line-height: 16px; }
`