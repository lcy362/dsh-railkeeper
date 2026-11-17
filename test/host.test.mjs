/**
 * 宿主半区的测试：文件存储、原子写入、坏数据隔离，以及 loopback 路由的栅栏。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { mkdtemp, readFile, writeFile, stat, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigStore, resolveDshHome, resolveProfileId } from '../src/host/store.js'
import { API_PREFIX, createApiHandler } from '../src/host/routes.js'
import { normalizeConfig } from '../src/shared/config.js'

const tempHome = () => mkdtemp(join(tmpdir(), 'railkeeper-test-'))

/** 起一个真的 HTTP 服务，走完整的请求路径而不是直接调 handler。 */
async function withServer(home, run, hooks = {}) {
  const store = new ConfigStore({ home, profileId: 'test' })
  const server = createServer(createApiHandler(store, hooks))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}${API_PREFIX}`
  try {
    await run({ base, store })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('home 解析：显式路径 > 环境变量 > 默认值', () => {
  const original = process.env.DSH_HOME
  try {
    delete process.env.DSH_HOME
    assert.match(resolveDshHome(undefined), /\.dsh$/)
    process.env.DSH_HOME = '/tmp/from-env'
    assert.equal(resolveDshHome(undefined), '/tmp/from-env')
    assert.equal(resolveDshHome('/tmp/explicit'), '/tmp/explicit')
    // 空白值必须被视为未设置，否则会把 home 解析成当前目录
    process.env.DSH_HOME = '   '
    assert.match(resolveDshHome(undefined), /\.dsh$/)
  } finally {
    if (original === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = original
  }
})

test('profile 解析：显式 > 环境变量 > default', () => {
  const original = process.env.DSH_PROFILE
  try {
    delete process.env.DSH_PROFILE
    assert.equal(resolveProfileId(undefined), 'default')
    process.env.DSH_PROFILE = 'desktop'
    assert.equal(resolveProfileId(undefined), 'desktop')
    assert.equal(resolveProfileId('web'), 'web')
  } finally {
    if (original === undefined) delete process.env.DSH_PROFILE
    else process.env.DSH_PROFILE = original
  }
})

test('文件不存在时读出默认配置，且不抛错', async () => {
  const home = await tempHome()
  const store = new ConfigStore({ home, profileId: 'test' })
  const { config, health } = await store.read()
  assert.deepEqual(config.sequence, [])
  assert.equal(health.exists, false)
  assert.equal(health.ok, true)
})

test('写入之后能原样读回，并且权限是 0600', async () => {
  const home = await tempHome()
  const store = new ConfigStore({ home, profileId: 'test' })
  await store.write({
    sequence: [{ type: 'panel', id: 'plugins' }, { type: 'group', id: 'g1', label: '统计', members: ['a', 'b'] }],
    panels: { plugins: { hidden: true } },
  })
  const { config } = await store.read()
  assert.deepEqual(config.sequence.map((row) => row.id), ['plugins', 'g1'])
  assert.equal(config.panels.plugins.hidden, true)
  const mode = (await stat(join(home, 'railkeeper.json'))).mode & 0o777
  assert.equal(mode, 0o600)
})

test('非法配置被拒绝，并且不落盘', async () => {
  const home = await tempHome()
  const store = new ConfigStore({ home, profileId: 'test' })
  await assert.rejects(() => store.write({ sequence: [], panels: { a: { icon: 'nope' } } }), /unknown icon/)
  await assert.rejects(() => readFile(join(home, 'railkeeper.json'), 'utf8'), /ENOENT/)
})

test('多个 profile 各存一份，互不影响', async () => {
  const home = await tempHome()
  const desktop = new ConfigStore({ home, profileId: 'desktop' })
  const web = new ConfigStore({ home, profileId: 'web' })
  await desktop.write({ sequence: [{ type: 'panel', id: 'desktop-only' }], panels: {} })
  await web.write({ sequence: [{ type: 'panel', id: 'web-only' }], panels: {} })
  assert.deepEqual((await desktop.read()).config.sequence.map((row) => row.id), ['desktop-only'])
  assert.deepEqual((await web.read()).config.sequence.map((row) => row.id), ['web-only'])
  // 顶层还保留了其它未知键的空间
  const raw = JSON.parse(await readFile(join(home, 'railkeeper.json'), 'utf8'))
  assert.deepEqual(Object.keys(raw.profiles).sort(), ['desktop', 'web'])
  // 版本号只在文档根上；分节里不该再出现一份
  assert.equal(raw.schemaVersion, 1)
  for (const section of Object.values(raw.profiles)) {
    assert.equal(section.schemaVersion, undefined)
    assert.ok(Array.isArray(section.sequence))
  }
  // 了解这一点的读者可以自己拼出完整文档再导入
  assert.equal(normalizeConfig(raw.profiles.desktop).ok, true)
})

test('损坏的配置会被备份到旁边，然后回落到默认值', async () => {
  const home = await tempHome()
  await writeFile(join(home, 'railkeeper.json'), '{ this is not json', { mode: 0o600 })
  const store = new ConfigStore({ home, profileId: 'test' })
  const { config, health } = await store.read()
  assert.deepEqual(config.sequence, [])
  assert.equal(health.corruption.detected, true)
  const files = await readdir(home)
  assert.ok(files.some((name) => name.includes('.corrupt-')), `expected a backup, saw ${files.join(',')}`)
  // 原文没有被删掉，用户还能自己找回
  assert.match(await readFile(health.corruption.backupPath, 'utf8'), /not json/)
})

test('重置回到空配置', async () => {
  const home = await tempHome()
  const store = new ConfigStore({ home, profileId: 'test' })
  await store.write({ sequence: [{ type: 'panel', id: 'plugins' }], panels: {} })
  const { config } = await store.reset()
  assert.deepEqual(config.sequence, [])
})

test('迁移：读 dsh-panellist 的配置并转换形状', async () => {
  const home = await tempHome()
  await writeFile(join(home, 'panellist.json'), JSON.stringify({
    schemaVersion: 2,
    profiles: {
      test: {
        sequence: [
          { type: 'entry', id: 'plugins' },
          { type: 'entry', id: 'schedules' },
          { type: 'group', id: 'group:g1', members: ['dsh-context', 'personal-kit-usage'], label: '统计' },
        ],
        entries: { schedules: { hidden: true }, plugins: { label: '插件中心', icon: 'star' } },
      },
    },
  }), { mode: 0o600 })

  const store = new ConfigStore({ home, profileId: 'test' })
  const legacy = await store.readLegacy()
  assert.equal(legacy.found, true)
  assert.deepEqual(legacy.config.sequence.map((row) => row.id), ['plugins', 'schedules', 'g_g1'])
  assert.deepEqual(legacy.config.sequence[2].members, ['dsh-context', 'personal-kit-usage'])
  assert.equal(legacy.config.sequence[2].label, '统计')
  assert.equal(legacy.config.panels.schedules.hidden, true)
  assert.equal(legacy.config.panels.plugins.label, '插件中心')
  assert.equal(legacy.config.panels.plugins.icon, 'star')
})

test('迁移：认不出的图标会被丢掉并记进 warnings，不会写进配置', async () => {
  const home = await tempHome()
  await writeFile(join(home, 'panellist.json'), JSON.stringify({
    profiles: { test: { sequence: [{ type: 'entry', id: 'plugins' }], entries: { plugins: { icon: 'panellist-only-glyph' } } } },
  }), { mode: 0o600 })
  const legacy = await new ConfigStore({ home, profileId: 'test' }).readLegacy()
  // 图标被丢掉后这条覆盖项已经没有任何内容，整条不该留下
  assert.equal(legacy.config.panels.plugins, undefined)
  assert.match(legacy.warnings.join(' '), /panellist-only-glyph/)
})

test('迁移：没有旧配置时如实返回未找到', async () => {
  const home = await tempHome()
  const legacy = await new ConfigStore({ home, profileId: 'test' }).readLegacy()
  assert.equal(legacy.found, false)
  assert.equal(legacy.config, null)
})

test('路由：health 与 config 可读', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const health = await (await fetch(`${base}/health`)).json()
    assert.equal(health.ok, true)
    assert.equal(health.profileId, 'test')
    const config = await (await fetch(`${base}/config`)).json()
    assert.deepEqual(config.config.sequence, [])
  })
})

test('路由：PUT 保存并读回', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const response = await fetch(`${base}/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: { sequence: [{ type: 'panel', id: 'plugins' }], panels: {} } }),
    })
    assert.equal(response.status, 200)
    const saved = await response.json()
    assert.equal(saved.ok, true)
    assert.deepEqual(saved.config.sequence.map((row) => row.id), ['plugins'])
    const read = await (await fetch(`${base}/config`)).json()
    assert.deepEqual(read.config.sequence.map((row) => row.id), ['plugins'])
  })
})

test('路由：非法配置返回 400 与原因', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const response = await fetch(`${base}/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: { sequence: [], panels: { a: { icon: 'nope' } } } }),
    })
    assert.equal(response.status, 400)
    const body = await response.json()
    assert.equal(body.ok, false)
    assert.match(body.error, /unknown icon/)
  })
})

test('路由：跨源写请求被拒（DNS rebinding 防护）', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const response = await fetch(`${base}/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ config: { sequence: [], panels: {} } }),
    })
    assert.equal(response.status, 403)
    assert.match((await response.json()).error, /cross-origin/)
  })
})

test('路由：同源写请求放行', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const origin = new URL(base).origin
    const response = await fetch(`${base}/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ config: { sequence: [], panels: {} } }),
    })
    assert.equal(response.status, 200)
  })
})

test('路由：未知端点返回 404', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const response = await fetch(`${base}/nope`)
    assert.equal(response.status, 404)
  })
})

test('路由：现场上报在内存里保留最近若干条', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    await fetch(`${base}/client-status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 'x', railFound: true }),
    })
    const records = await (await fetch(`${base}/client-status`)).json()
    assert.equal(records.records.length, 1)
    assert.equal(records.records[0].railFound, true)
    assert.equal(records.records[0].profileId, 'test')
  })
})

test('路由：DSH 栅栏返回 403 时直接拒绝', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const response = await fetch(`${base}/health`)
    assert.equal(response.status, 403)
  }, { requestRejection: () => 403 })
})

test('路由：DSH 栅栏返回 401 时退回本地判据（回环请求放行）', async () => {
  // 桌面端页面由 dsh-app:// 加载，与 127.0.0.1 不同源，fetch 不一定带得上
  // auth cookie。一律按 401 拒会把界面读数整个掐死。
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const response = await fetch(`${base}/health`)
    assert.equal(response.status, 200)
  }, { requestRejection: () => 401 })
})

test('路由：DSH 栅栏自己抛错时不能让请求崩掉', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const response = await fetch(`${base}/health`)
    assert.equal(response.status, 200, '栅栏异常时退回本地判据，而不是 500')
  }, {
    requestRejection: () => {
      throw new Error('service exploded')
    },
  })
})

test('路由：写请求不声明 JSON 时回 415', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const response = await fetch(`${base}/config/reset`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    })
    assert.equal(response.status, 415)
  })
})

test('路由：PUT 不声明 JSON 时同样回 415', async () => {
  const home = await tempHome()
  await withServer(home, async ({ base }) => {
    const response = await fetch(`${base}/config`, {
      method: 'PUT',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'config=%7B%7D',
    })
    assert.equal(response.status, 415)
  })
})
