/**
 * 遮蔽条目的回归测试 —— 重点是「有界」。
 *
 * 这里照着 `dsh-client-ui-slots` 的 SlotCore 语义搭了一个最小注册表：
 *   - list 槽位按 id 定址，(id, priority) 唯一，重复注册抛错；
 *   - 条目按 priority 升序、再按 order 升序排序；
 *   - `entries()` 给全部条目，`entriesOfSlot()` 每格只给赢家；
 *   - 变更通知走 queueMicrotask 批量 flush。
 *
 * 然后让「本插件」和「插件市场」同时观察同一个槽位跑一轮。插件市场的行为是
 * 从 dshmarket 的 client 里逐行抄的：它会给 `plugins` 这一格注册 priority -1 的
 * 装饰条目，并在每次 `sidebar.panellist` 变化时重新 reconcile。
 *
 * 早期实现（原地改别人的条目 + nudge）在这个场景里不会收敛——两边互相触发，
 * 微任务链无限延长，事件循环拿不到时间片，界面卡死。这组测试把「有界」钉死。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPlan } from '../src/client/model.js'
import { defaultConfig } from '../src/shared/config.js'
import {
  diffShadows,
  planShadows,
  shadowPriorityFor,
  shadowSignature,
  sourceEntryFor,
} from '../src/client/shadow.js'

/** 最小槽位注册表，语义对齐 dsh-client-ui-slots 的 SlotCore。 */
function createRegistry() {
  const records = new Map()
  const dirty = new Set()
  let flushScheduled = false
  let flushes = 0

  const record = (name) => {
    let entry = records.get(name)
    if (entry === undefined) {
      entry = { spec: undefined, entries: [], version: 0, listeners: new Set() }
      records.set(name, entry)
    }
    return entry
  }

  const markDirty = (target) => {
    target.version += 1
    dirty.add(target)
    if (flushScheduled) return
    flushScheduled = true
    queueMicrotask(() => {
      flushScheduled = false
      const batch = [...dirty]
      dirty.clear()
      flushes += 1
      for (const item of batch) for (const listener of [...item.listeners]) listener()
    })
  }

  return {
    declare(name, spec) {
      record(name).spec = spec
    },
    register(options, component) {
      const target = record(options.name)
      if (target.spec === undefined) throw new Error(`slot "${options.name}" is not declared`)
      const priority = options.priority ?? 0
      if (target.spec.kind === 'list') {
        if (options.id === undefined) throw new Error('list slot requires options.id')
        if (target.entries.some((e) => e.options.id === options.id && (e.options.priority ?? 0) === priority)) {
          throw new Error(`list slot "${options.name}" already has an entry with id "${options.id}" at priority ${priority}`)
        }
      }
      const entry = {
        component,
        options: {
          ...(options.id === undefined ? {} : { id: options.id }),
          ...(options.key === undefined ? {} : { key: options.key }),
          ...(options.order === undefined ? {} : { order: options.order }),
          ...(options.label === undefined ? {} : { label: options.label }),
          ...(options.priority === undefined ? {} : { priority: options.priority }),
        },
      }
      target.entries = [...target.entries, entry].sort(
        (a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0) || (a.options.order ?? 0) - (b.options.order ?? 0),
      )
      markDirty(target)
      return () => {
        if (!target.entries.includes(entry)) return
        target.entries = target.entries.filter((candidate) => candidate !== entry)
        markDirty(target)
      }
    },
    entries(name) {
      return records.get(name)?.entries ?? []
    },
    entriesOfSlot(name) {
      const target = records.get(name)
      if (target?.spec === undefined) return []
      const out = []
      const seen = new Set()
      for (const entry of target.entries) {
        const key = target.spec.kind === 'list' ? entry.options.id : entry.options.key
        if (seen.has(key)) continue
        seen.add(key)
        out.push(entry)
      }
      return out
    },
    subscribe(name, listener) {
      const target = record(name)
      target.listeners.add(listener)
      return () => target.listeners.delete(listener)
    },
    flushes: () => flushes,
  }
}

/** 插件市场：给 `plugins` 这一格套更新角标，行为照抄 dshmarket。 */
function installMarket(registry, log) {
  let original
  let Decoration
  let stopDecoration
  let reconciling = false
  let changedWhileReconciling = false
  const canWrap = (entry) => typeof entry.component === 'function'
  const remove = () => {
    const stop = stopDecoration
    stopDecoration = undefined
    Decoration = undefined
    original = undefined
    if (stop !== undefined) stop()
  }
  const reconcile = () => {
    if (reconciling) {
      changedWhileReconciling = true
      return
    }
    reconciling = true
    try {
      const entries = registry
        .entries('sidebar.panellist')
        .filter((entry) => entry.options.id === 'plugins' && entry.component !== Decoration)
      const next = entries.length === 1 && (entries[0].options.priority ?? 0) === 0 && canWrap(entries[0])
        ? entries[0]
        : undefined
      if (next === original) return
      remove()
      if (next === undefined) return
      if (registry.entriesOfSlot('sidebar.panellist').find((entry) => entry.options.id === 'plugins') !== next) return
      const Source = next.component
      Decoration = function MarketDecoration() {
        return { wrapped: Source }
      }
      stopDecoration = registry.register({
        name: 'sidebar.panellist',
        id: 'plugins',
        priority: -1,
        ...(next.options.order === undefined ? {} : { order: next.options.order }),
        ...(next.options.label === undefined ? {} : { label: next.options.label }),
      }, Decoration)
      original = next
      log.decorations += 1
    } finally {
      reconciling = false
      if (changedWhileReconciling) {
        changedWhileReconciling = false
        queueMicrotask(reconcile)
      }
    }
  }
  return registry.subscribe('sidebar.panellist', reconcile)
}

/**
 * 本插件的一轮同步，走生产代码用的同一套纯函数。
 * @param {{ registry: any, config: any, shadows: Map<string, any>, log: any, natives?: any[] }} deps
 */
function syncRailkeeper({ registry, config, shadows, log }) {
  const all = registry.entries('sidebar.panellist')
  const natives = all.filter((entry) => !log.own.has(entry.component))
  // 与生产代码的 livePanels 一致：同一 id 只取注册表顺序里的第一条（赢家），
  // 否则同一格的多条条目会被数成多个面板。
  const seen = new Set()
  const live = natives
    .map((entry, index) => ({
      id: entry.options.id,
      order: typeof entry.options.order === 'number' ? entry.options.order : index,
      label: typeof entry.options.label === 'function' ? entry.options.label() : String(entry.options.label ?? entry.options.id),
      index,
    }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .filter((item) => {
      if (typeof item.id !== 'string' || seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  const plan = buildPlan(config, live)
  const wanted = planShadows(plan, config.panels, natives)
  const { dispose, register } = diffShadows(shadows, wanted)
  for (const id of dispose) {
    const current = shadows.get(id)
    shadows.delete(id)
    current?.dispose()
    log.disposed += 1
  }
  for (const id of register) {
    const target = wanted.get(id)
    if (target === undefined) continue
    const wrapper = function RailkeeperIcon() {
      return { shadowOf: id }
    }
    log.own.add(wrapper)
    const off = registry.register({
      name: 'sidebar.panellist',
      id,
      order: target.order,
      priority: target.priority,
      label: target.label.length > 0 ? target.label : undefined,
    }, wrapper)
    shadows.set(id, { dispose: off, signature: target.signature })
    log.registered += 1
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * 跑一轮共存模拟。
 * @param {{ config?: any, budget?: number }} [options]
 */
async function coexist(options = {}) {
  const registry = createRegistry()
  registry.declare('sidebar.panellist', { kind: 'list', scope: 'root' })
  const log = { decorations: 0, registered: 0, disposed: 0, own: new Set(), sourceIds: new Map() }

  const pluginIcon = function PluginIcon() {}
  const marketIcon = function MarketIcon() {}
  log.sourceIds.set(pluginIcon, 1)
  log.sourceIds.set(marketIcon, 2)
  registry.register({ name: 'sidebar.panellist', id: 'plugins', order: 100, label: () => '插件' }, pluginIcon)
  registry.register({ name: 'sidebar.panellist', id: 'dsh-market', order: 140, label: () => '插件市场' }, marketIcon)

  installMarket(registry, log)
  await settle()

  const shadows = new Map()
  const config = options.config ?? {
    ...defaultConfig(),
    // 用户点了「合并插件 + 插件市场」：两个面板合成一个分组。
    sequence: [{ type: 'group', id: 'g_1', label: '市场', members: ['plugins', 'dsh-market'] }],
    panels: {},
  }

  let rounds = 0
  const budget = options.budget ?? 50
  const unsubscribe = registry.subscribe('sidebar.panellist', () => {
    if (rounds >= budget) return
    rounds += 1
    syncRailkeeper({ registry, config, shadows, log })
  })
  syncRailkeeper({ registry, config, shadows, log })
  for (let index = 0; index < budget; index += 1) await settle()
  unsubscribe()
  return { registry, log, shadows, rounds, flushes: registry.flushes(), config }
}

test('合并两个面板：与插件市场共存时有界收敛', async () => {
  const { registry, log, shadows, rounds, flushes } = await coexist()
  // 关键断言：一轮合并不能让 slot 通知无限自我喂养。
  assert.ok(rounds < 20, `一轮合并只应触发少量同步，实际 ${rounds} 次`)
  assert.ok(flushes < 20, `slot 通知应当收敛，实际 flush ${flushes} 次`)
  // 合并会改变相对顺序，两个面板都要被盖住；但别人的条目一个都没被改。
  assert.deepEqual([...shadows.keys()].sort(), ['dsh-market', 'plugins'])
  const pluginEntries = registry.entries('sidebar.panellist').filter((e) => e.options.id === 'plugins')
  // 原生 1 + 我们 1。市场的角标层不在了——这是它自己的规则：只有该格「恰好一条」
  // 时才挂角标，我们加了一层它就主动撤回。我们从不改它的对象，所以它想挂回来
  // 随时可以，只是在我们管着这一格期间不会。
  assert.equal(pluginEntries.length, 2)
  assert.ok(pluginEntries.some((entry) => (entry.options.priority ?? 0) < 0), '我们的遮蔽层必须更低')
})

test('计划不变时不重新注册任何条目', async () => {
  const { registry, log, shadows, config } = await coexist()
  const before = { registered: log.registered, disposed: log.disposed, entries: registry.entries('sidebar.panellist').length }
  // 再跑十轮「没有任何变化」的同步
  for (let index = 0; index < 10; index += 1) {
    syncRailkeeper({ registry, config, shadows, log })
  }
  assert.equal(log.registered, before.registered, '签名没变就不能重注册')
  assert.equal(log.disposed, before.disposed, '签名没变就不能摘条目')
  assert.equal(registry.entries('sidebar.panellist').length, before.entries, '条目数必须稳定')
})

test('用户没动过的面板不遮蔽，装饰照常生效', async () => {
  // 空配置：顺序就是原生顺序，没有任何覆盖项。
  const { shadows } = await coexist({ config: defaultConfig() })
  assert.equal(shadows.size, 0, '没改动就不该注册任何遮蔽条目')
})

test('只隐藏一个面板时，另一个不遮蔽', async () => {
  const { shadows } = await coexist({
    config: {
      ...defaultConfig(),
      sequence: [{ type: 'panel', id: 'plugins' }, { type: 'panel', id: 'dsh-market' }],
      panels: { 'dsh-market': { hidden: true } },
    },
  })
  assert.deepEqual([...shadows.keys()], ['dsh-market'])
})

test('遮蔽条目的 priority 永远比同格其它注册者低', () => {
  const natives = [
    { options: { id: 'plugins', priority: 0 } },
    { options: { id: 'plugins', priority: -1 } },
    { options: { id: 'other' } },
  ]
  assert.equal(shadowPriorityFor('plugins', natives), -2)
  assert.equal(shadowPriorityFor('other', natives), -1)
  assert.equal(shadowPriorityFor('missing', natives), -1)
})

test('原生赢家是市场套好角标的那一份，不是更内层的原始图标', () => {
  const decoration = function MarketDecoration() {}
  const natives = [
    { options: { id: 'plugins', priority: -1 }, component: decoration },
    { options: { id: 'plugins', priority: 0 }, component: function PluginIcon() {} },
  ]
  // 注册表已按 priority 排序，第一个就是原生赢家
  assert.equal(sourceEntryFor('plugins', natives).component, decoration)
})

test('签名只随真正需要重注册的维度变化', () => {
  const base = { order: 100, label: '', icon: null, hidden: false }
  assert.equal(shadowSignature(base), shadowSignature({ ...base }))
  assert.notEqual(shadowSignature(base), shadowSignature({ ...base, order: 110 }))
  assert.notEqual(shadowSignature(base), shadowSignature({ ...base, hidden: true }))
  assert.notEqual(shadowSignature(base), shadowSignature({ ...base, label: '改名' }))
})

test('diffShadows 只给出最小操作集', () => {
  const current = new Map([
    ['a', { signature: 'x' }],
    ['b', { signature: 'y' }],
  ])
  const wanted = new Map([
    ['a', { signature: 'x' }],
    ['b', { signature: 'z' }],
    ['c', { signature: 'w' }],
  ])
  const result = diffShadows(current, wanted)
  assert.deepEqual(result.dispose.sort(), ['b'])
  assert.deepEqual(result.register.sort(), ['b', 'c'])
})

test('卸载时只摘自己的条目，原生注册原样保留', async () => {
  const { registry, log, shadows } = await coexist()
  const ownCount = shadows.size
  assert.equal(registry.entries('sidebar.panellist').length, 2 + ownCount)
  for (const [, shadow] of shadows) shadow.dispose()
  shadows.clear()
  const remaining = registry.entries('sidebar.panellist')
  // 原生两个一个都不少，且 priority 保持原值（我们从没写过别人的字段）
  assert.equal(remaining.length, 2)
  assert.deepEqual(remaining.map((entry) => entry.options.id).sort(), ['dsh-market', 'plugins'])
  assert.ok(remaining.every((entry) => (entry.options.priority ?? 0) === 0))
  // 市场发现该格又只剩一条了，会自己把角标挂回来——证明我们没破坏它的路径。
  await settle()
  await settle()
  assert.ok(registry.entries('sidebar.panellist').some((entry) => entry.options.priority === -1), '市场应当自动恢复装饰')
  assert.ok(log.decorations >= 1)
})
