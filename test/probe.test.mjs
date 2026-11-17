/**
 * 自检的回归测试。
 *
 * 起因是一个用户可见的现象：侧栏**偶尔有一行显示成选中状态**，而他并没有点。
 * 查下来是插件启动 1.2 秒后自动跑的自检：它为了验证「点分组菜单里的成员会不会
 * 切过去」，真的调用 selectPanel 切一次再切回来。原以为两次变更在同一个 tick 里、
 * React 会合并成一次渲染所以看不见——这个假设是错的：layout.selectPanel 会先
 * abort() 当前导航并同步通知订阅者，中间那一帧照常提交，侧栏（以及它所属的分组行）
 * 会闪一下选中态。
 *
 * 所以自检默认必须关着。这组测试钉住两件事：
 *   1. 启动后不得自动调用 selectPanel；
 *   2. 用户手动触发时仍然真的切（能力没丢）。
 *
 * 为了能测，这里把 bundle 加载进一个最小浏览器环境（document / localStorage /
 * navigator 都是桩），并用与 SlotCore 同语义的注册表把插件真的 apply() 起来。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 与 dsh-client-ui-slots 的 SlotCore 同语义的最小注册表。 */
function createRegistry() {
  const records = new Map()
  const dirty = new Set()
  let flushScheduled = false
  const record = (name) => {
    let entry = records.get(name)
    if (entry === undefined) {
      entry = { spec: undefined, entries: [], listeners: new Set() }
      records.set(name, entry)
    }
    return entry
  }
  const markDirty = (target) => {
    dirty.add(target)
    if (flushScheduled) return
    flushScheduled = true
    queueMicrotask(() => {
      flushScheduled = false
      const batch = [...dirty]
      dirty.clear()
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
      if (target.spec.kind === 'list' && target.entries.some((e) => e.options.id === options.id && (e.options.priority ?? 0) === priority)) {
        throw new Error(`list slot "${options.name}" already has id "${options.id}" at priority ${priority}`)
      }
      if (target.spec.kind === 'keyed' && options.key === undefined) throw new Error('keyed slot requires options.key')
      const entry = {
        component,
        options: { id: options.id, key: options.key, order: options.order, priority: options.priority, label: options.label },
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
    entries: (name) => records.get(name)?.entries ?? [],
    entriesOfSlot(name) {
      const target = records.get(name)
      if (target?.spec === undefined) return []
      const kind = target.spec.kind
      const out = []
      const seen = new Set()
      for (const entry of target.entries) {
        const key = kind === 'keyed' ? entry.options.key : entry.options.id
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
    // 真实内核里 inject 是异步通知的；同步回调会让 start() 在槽位就绪前就重建，
    // 测出来的行为与线上不一致（曾经因此误判过）。
    inject(_name, callback) {
      queueMicrotask(() => callback())
      return () => {}
    },
  }
}

/** 极简 React 替身：只够把组件树搭出来，不渲染。 */
function createReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props, children: children.flat(Infinity) }),
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
    useLayoutEffect: () => {},
    useRef: () => ({ current: null }),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useContext: () => null,
    createContext: () => ({ Provider: (props) => props.children }),
    Fragment: 'Fragment',
  }
}

/**
 * 在最小浏览器环境里加载 bundle 并 apply()。
 * @param {{ config: any, probeFlag?: boolean }} options
 */
async function boot(options) {
  const source = await readFile(path.join(ROOT, 'lib/client.js'), 'utf8')
  const React = createReact()
  const selectCalls = []
  let activePanelId = null

  const storage = new Map()
  if (options.probeFlag === true) storage.set('dsh-railkeeper.probe', '1')

  globalThis.window = {
    __ModuleLoader__: { load: (definition) => { globalThis.__captured = definition } },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    open() {},
    addEventListener() {},
    removeEventListener() {},
    innerWidth: 1280,
    innerHeight: 800,
  }
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute() {}, appendChild() {} }),
    addEventListener() {},
    removeEventListener() {},
    visibilityState: 'visible',
    head: { appendChild() {} },
  }
  globalThis.Element = class {}
  globalThis.HTMLStyleElement = class {}
  // Node 22+ 的 navigator 只有 getter，得用 defineProperty 覆盖
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'zh-CN', userAgent: 'node' },
    configurable: true,
    writable: true,
  })
  globalThis.AbortController = class {
    constructor() { this.signal = undefined }
    abort() {}
  }
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, profileId: 'default', config: options.config, health: {} }),
  })

  const require = (id) => {
    if (id === 'react') return React
    if (id === 'react-dom') return { createPortal: () => null }
    if (id === 'react/jsx-runtime') return { jsx: () => null }
    throw new Error(`unexpected require "${id}"`)
  }
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', source)(require, { exports: {} }, {})
  const entry = globalThis.__captured.factory(require)

  const registry = createRegistry()
  for (const [name, spec] of [
    ['sidebar.panellist', { kind: 'list', scope: 'root' }],
    ['main', { kind: 'keyed', scope: 'root' }],
    ['settings.section', { kind: 'list', scope: 'root' }],
    ['root', { kind: 'single', scope: 'root' }],
  ]) registry.declare(name, spec)

  registry.register({ name: 'sidebar.panellist', id: 'plugins', order: 100, label: () => '插件' }, function PluginIcon() {})
  registry.register({ name: 'sidebar.panellist', id: 'dsh-market', order: 140, label: () => '插件市场' }, function MarketIcon() {})
  registry.register({ name: 'main', key: 'plugins' }, function PluginsPage() {})
  registry.register({ name: 'main', key: 'dsh-market' }, function MarketPage() {})

  let settingsSection = null
  const rawRegister = registry.register
  registry.register = function (slotOptions, component) {
    if (slotOptions.name === 'settings.section') settingsSection = component
    return rawRegister.call(this, slotOptions, component)
  }

  const layout = {
    panelInfo: {
      getSnapshot: () => ({ activePanelId }),
      subscribe: () => () => {},
    },
    selectPanel(id) {
      selectCalls.push(id)
      activePanelId = id
    },
  }
  const ctx = {
    get: (name) => (name === 'layout' ? layout : undefined),
    inject: (names, callback) => { queueMicrotask(() => callback(ctx)); return () => {} },
    effect: (fn) => { fn() },
    slots: registry,
  }

  entry.apply(ctx)

  /** 从设置组件树里挖出 rail controller（有 runProbe + getPlan 的那个对象）。 */
  const findRail = () => {
    if (settingsSection === null) return null
    let found = null
    const seen = new Set()
    const hunt = (node, depth) => {
      if (found !== null || depth > 12 || node === null || typeof node !== 'object' || seen.has(node)) return
      seen.add(node)
      if (typeof node.runProbe === 'function' && typeof node.getPlan === 'function') { found = node; return }
      for (const key of Object.keys(node)) {
        const value = node[key]
        if (value !== null && typeof value === 'object') hunt(value, depth + 1)
      }
    }
    try { hunt(settingsSection(), 0) } catch { /* 组件渲染失败不影响断言 */ }
    return found
  }

  return { selectCalls, findRail }
}

const CONFIG = {
  schemaVersion: 1,
  sequence: [{ type: 'group', id: 'g_1', label: '插件', members: ['plugins', 'dsh-market'] }],
  panels: {},
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('启动后不会自动切换面板（否则侧栏会闪一下选中态）', async () => {
  const { selectCalls } = await boot({ config: CONFIG })
  await wait(2500)
  assert.deepEqual(selectCalls, [], `启动期间不该有任何 selectPanel 调用，实际：${JSON.stringify(selectCalls)}`)
})

test('启动后计划正确构建（样式失败不该拖垮控制器）', async () => {
  const { findRail } = await boot({ config: CONFIG })
  await wait(2500)
  const rail = findRail()
  assert.notEqual(rail, null, '应当能取到 controller')
  const plan = rail.getPlan()
  assert.equal(plan.groups.size, 1, '配置里的分组应当出现在计划里')
  assert.deepEqual(plan.rows.map((row) => `${row.kind}:${row.id}`), ['group:g_1'])
})

test('手动触发时自检仍然真的切换面板', async () => {
  const { selectCalls, findRail } = await boot({ config: CONFIG })
  await wait(2500)
  const rail = findRail()
  assert.notEqual(rail, null)
  const before = selectCalls.length
  rail.runProbe()
  await wait(800)
  const after = selectCalls.slice(before)
  assert.ok(after.length > 0, '手动自检必须真的切一次')
  // 切过去之后要切回来
  assert.equal(after.length, 2, `应当是「切走 + 切回」两次，实际：${JSON.stringify(after)}`)
})

test('显式打开开关时启动自检才会跑', async () => {
  const { selectCalls } = await boot({ config: CONFIG, probeFlag: true })
  await wait(2500)
  assert.ok(selectCalls.length > 0, '开关打开时应当自动跑一次自检')
})
