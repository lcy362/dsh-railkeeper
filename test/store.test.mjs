/**
 * 浏览器侧配置状态的测试：防抖写入、脏标记、失败重试。
 *
 * 这一层不碰 React / DOM，可以直接在 node 里跑。回归重点只有一条：
 * 一次改动只能产生一次写入——历史上 `revision` 会被 `saving` 标志自己推进，
 * 于是每次保存回来都被判成「又脏了」，界面上的「保存中」永远闪、宿主每秒
 * 被写七八次。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createConfigStore } from '../src/client/store.js'
import { defaultConfig } from '../src/shared/config.js'

const i18n = { t: (key, vars) => (vars === undefined ? key : `${key} ${JSON.stringify(vars)}`) }

/**
 * @param {{ delayMs?: number, fail?: (call: number) => boolean }} [options]
 */
function fakeApi(options = {}) {
  const calls = []
  let inflight = 0
  let peak = 0
  const api = {
    async load() {
      return { config: { ...defaultConfig(), sequence: [{ type: 'panel', id: 'plugins' }] }, profileId: 'p' }
    },
    async save(config) {
      calls.push(config)
      inflight += 1
      peak = Math.max(peak, inflight)
      try {
        const index = calls.length
        if (options.delayMs !== undefined) await new Promise((resolve) => setTimeout(resolve, options.delayMs))
        if (options.fail?.(index) === true) throw new Error('boom')
        return { ok: true, config, profileId: 'p' }
      } finally {
        inflight -= 1
      }
    },
    async reset() {
      return { config: defaultConfig(), profileId: 'p' }
    },
    async legacy() {
      return { config: null, warnings: [] }
    },
  }
  return { api, calls, peak: () => peak }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 一次「改名」编辑。 */
function rename(store, id, label) {
  return store.update((config) => ({
    ...config,
    panels: { ...config.panels, [id]: { ...(config.panels?.[id] ?? {}), label } },
  }))
}

test('一次改动只写一次，保存后立刻回到「已保存」', async () => {
  const { api, calls } = fakeApi()
  const store = createConfigStore(api, i18n)
  await store.load()

  assert.equal(rename(store, 'plugins', '插件页'), true)
  assert.equal(store.getSnapshot().dirty, true)

  await sleep(900)
  assert.equal(calls.length, 1, '一次编辑只能落一次盘')
  assert.deepEqual(
    { saving: store.getSnapshot().saving, dirty: store.getSnapshot().dirty, status: store.getSnapshot().status },
    { saving: false, dirty: false, status: 'ready' },
  )
  // 再等一会儿，确认没有「后台补刀」式的循环写入
  await sleep(700)
  assert.equal(calls.length, 1, '收敛之后不能再有写入')
  store.dispose()
})

test('连打多个字只写一次，写的是最后那一版', async () => {
  const { api, calls } = fakeApi()
  const store = createConfigStore(api, i18n)
  await store.load()

  rename(store, 'plugins', '插')
  rename(store, 'plugins', '插件')
  rename(store, 'plugins', '插件页')
  await sleep(900)

  assert.equal(calls.length, 1)
  assert.equal(calls[0].panels.plugins.label, '插件页')
  store.dispose()
})

test('写入返回时又有一处没保存的改动，服务端回包不能把它盖掉', async () => {
  const { api, calls } = fakeApi({ delayMs: 120 })
  const store = createConfigStore(api, i18n)
  await store.load()

  rename(store, 'plugins', '第一版')
  await sleep(470) // 防抖 450ms 之后请求已经发出，回包还没到
  rename(store, 'plugins', '第二版')
  assert.equal(store.getSnapshot().saving, true)

  await sleep(900)
  assert.equal(calls.length, 2, '飞行期间的新改动要再存一次')
  assert.equal(calls[1].panels.plugins.label, '第二版', '第二次写的是新值，不是回包里的旧值')
  assert.equal(store.getSnapshot().config.panels.plugins.label, '第二版')
  assert.equal(store.getSnapshot().dirty, false)
  store.dispose()
})

test('同一时刻只有一个写入在飞', async () => {
  const { api, peak } = fakeApi({ delayMs: 80 })
  const store = createConfigStore(api, i18n)
  await store.load()

  for (let index = 0; index < 6; index += 1) {
    rename(store, 'plugins', `版本${index}`)
    await sleep(60)
  }
  await sleep(1200)
  assert.equal(peak(), 1)
  assert.equal(store.getSnapshot().dirty, false)
  store.dispose()
})

test('写失败保留脏标记，重试成功后清掉', async () => {
  const { api, calls } = fakeApi({ fail: (call) => call === 1 })
  const store = createConfigStore(api, i18n)
  await store.load()

  rename(store, 'plugins', '插件页')
  await sleep(700)
  assert.equal(calls.length, 1)
  assert.equal(store.getSnapshot().dirty, true)
  assert.equal(store.getSnapshot().saving, false)
  assert.match(String(store.getSnapshot().error), /status\.error/)

  store.retry()
  await sleep(200)
  assert.equal(calls.length, 2)
  assert.equal(store.getSnapshot().dirty, false)
  assert.equal(store.getSnapshot().error, null)
  store.dispose()
})

test('导入立即写盘，读取失败不影响已有配置', async () => {
  const { api, calls } = fakeApi()
  const store = createConfigStore(api, i18n)
  await store.load()

  const result = store.importJson(JSON.stringify({ schemaVersion: 1, sequence: [{ type: 'panel', id: 'schedules' }], panels: {} }))
  assert.equal(result.ok, true)
  await sleep(120)
  assert.equal(calls.length, 1)
  assert.deepEqual(store.getSnapshot().config.sequence, [{ type: 'panel', id: 'schedules' }])
  store.dispose()
})

test('dispose 之后不再写盘', async () => {
  const { api, calls } = fakeApi()
  const store = createConfigStore(api, i18n)
  await store.load()

  rename(store, 'plugins', '插件页')
  store.dispose()
  await sleep(700)
  assert.equal(calls.length, 0)
})