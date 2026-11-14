/**
 * 配置模型的测试：哪些输入会被接受、哪些会被修掉、哪些会被拒绝。
 * 配置是唯一落盘的东西，坏数据会一直跟着用户，所以这里把边界写死。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BUILTIN_ICONS, SCHEMA_VERSION, createGroupId, defaultConfig, normalizeConfig,
} from '../src/shared/config.js'

test('默认配置是空的，且带当前结构版本', () => {
  const config = defaultConfig()
  assert.equal(config.schemaVersion, SCHEMA_VERSION)
  assert.deepEqual(config.sequence, [])
  assert.deepEqual(config.panels, {})
})

test('接受一个形状正确的配置', () => {
  const result = normalizeConfig({
    sequence: [
      { type: 'panel', id: 'plugins' },
      { type: 'group', id: 'g1', label: '统计', icon: 'chart', members: ['a', 'b'] },
    ],
    panels: { plugins: { hidden: true, label: '插件', icon: 'star' } },
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.equal(result.config.sequence.length, 2)
  assert.equal(result.config.sequence[1].label, '统计')
  assert.equal(result.config.sequence[1].icon, 'chart')
  assert.deepEqual(result.config.panels.plugins, { label: '插件', icon: 'star', hidden: true })
})

test('未知图标名会被报错，而不是写进配置', () => {
  const result = normalizeConfig({ sequence: [], panels: { a: { icon: 'not-a-real-icon' } } })
  assert.equal(result.ok, false)
  assert.match(result.errors[0], /unknown icon/)
})

test('内置图标名单里的每一个都能通过校验', () => {
  for (const icon of BUILTIN_ICONS) {
    const result = normalizeConfig({ sequence: [], panels: { a: { icon } } })
    assert.equal(result.ok, true, `icon ${icon} should be accepted`)
  }
})

test('同一个面板不会出现两次', () => {
  const result = normalizeConfig({
    sequence: [{ type: 'panel', id: 'a' }, { type: 'panel', id: 'a' }],
  })
  assert.equal(result.ok, false)
  assert.match(result.errors[0], /more than once/)
})

test('分组会吸收成员，成员不会同时留在顶层', () => {
  const result = normalizeConfig({
    sequence: [{ type: 'panel', id: 'a' }, { type: 'group', id: 'g', members: ['a', 'b'] }],
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.config.sequence.map((row) => row.id), ['a', 'g'])
  assert.deepEqual(result.config.sequence[1].members, ['b'])
})

test('分组内的重复成员会被去重，只留一份', () => {
  const result = normalizeConfig({ sequence: [{ type: 'group', id: 'g', members: ['a', 'a', 'b'] }] })
  assert.equal(result.ok, true)
  assert.deepEqual(result.config.sequence[0].members, ['a', 'b'])
})

test('没有任何成员的分组会被丢掉，并作为错误报出来', () => {
  const result = normalizeConfig({ sequence: [{ type: 'group', id: 'g', members: [] }] })
  assert.deepEqual(result.config.sequence, [])
  // 成员全是不认识/空的 id 属于坏输入，必须让调用方知道，而不是安静地少一行
  assert.equal(result.ok, false)
  assert.match(result.errors[0], /at least one member/)
})

test('id 里的空白与控制字符会被拒绝', () => {
  for (const bad of ['has space', 'tab\there', '', '   ', 'x'.repeat(129)]) {
    const result = normalizeConfig({ sequence: [{ type: 'panel', id: bad }] })
    assert.equal(result.ok, false, `id ${JSON.stringify(bad)} should be rejected`)
  }
})

test('名称会被裁剪，超长或空白的名称不写进配置', () => {
  const trimmed = normalizeConfig({ sequence: [], panels: { a: { label: '  统计  ' } } })
  assert.equal(trimmed.config.panels.a.label, '统计')
  const blank = normalizeConfig({ sequence: [], panels: { a: { label: '   ' } } })
  assert.equal(blank.ok, false)
})

test('hidden 只接受布尔值', () => {
  const result = normalizeConfig({ sequence: [], panels: { a: { hidden: 'yes' } } })
  assert.equal(result.ok, false)
  assert.match(result.errors[0], /must be a boolean/)
})

test('完全不是对象的输入回落到默认配置', () => {
  for (const bad of [null, 42, 'text', []]) {
    const result = normalizeConfig(bad)
    assert.deepEqual(result.config, defaultConfig())
    assert.equal(result.ok, false)
  }
  // undefined 表示“还没有配置”，是正常状态，不算错误
  assert.equal(normalizeConfig(undefined).ok, true)
})

test('生成的分组 id 稳定可用且各不相同', () => {
  const ids = new Set()
  for (let index = 0; index < 50; index += 1) ids.add(createGroupId(index))
  assert.equal(ids.size, 50)
  for (const id of ids) {
    assert.equal(normalizeConfig({ sequence: [{ type: 'group', id, members: ['a'] }] }).ok, true)
  }
})

test('缺失 id 的分组会被补一个可用的 id', () => {
  const result = normalizeConfig({ sequence: [{ type: 'group', members: ['a'] }] })
  assert.equal(result.ok, true)
  assert.match(result.config.sequence[0].id, /^g_/)
})

test('超大序列会被截断并报错，不会静默接受', () => {
  const sequence = Array.from({ length: 250 }, (_, index) => ({ type: 'panel', id: `p${index}` }))
  const result = normalizeConfig({ sequence })
  assert.equal(result.ok, false)
  assert.ok(result.config.sequence.length <= 200)
})
