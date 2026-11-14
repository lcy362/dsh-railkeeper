/**
 * 渲染计划的测试：配置 + 当前注册表 → 每一行该排在哪、哪些要隐藏。
 * 这是纯函数，所以边界条件可以全部钉死。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultConfig, normalizeConfig } from '../src/shared/config.js'
import {
  buildPlan, clearPanelOverride, findOrphans, groupPanels, materialize, moveRow, moveRowBefore,
  removeMember, removePanelRow, setGroupField, setPanelField, ungroup,
} from '../src/client/model.js'

/** @param {Record<string, unknown>} raw */
const configOf = (raw) => {
  const result = normalizeConfig(raw)
  assert.equal(result.ok, true, result.errors.join('; '))
  return result.config
}

const LIVE = [
  { id: 'plugins', order: 0, label: '插件' },
  { id: 'schedules', order: 10, label: '自动化任务' },
  { id: 'dsh-context', order: 20, label: '上下文洞察' },
  { id: 'personal-kit-usage', order: 30, label: '用量台账' },
]

test('未写进配置的面板按注册顺序追加到末尾', () => {
  const plan = buildPlan(defaultConfig(), LIVE)
  assert.deepEqual(plan.rows.map((row) => row.id), ['plugins', 'schedules', 'dsh-context', 'personal-kit-usage'])
  for (const row of plan.rows) assert.equal(row.kind, 'panel')
})

test('materialize 只追加、不删除', () => {
  const config = configOf({ sequence: [{ type: 'panel', id: 'removed-plugin' }] })
  const next = materialize(config, LIVE)
  assert.deepEqual(
    next.sequence.map((row) => row.id),
    ['removed-plugin', 'plugins', 'schedules', 'dsh-context', 'personal-kit-usage'],
  )
})

test('已安装的面板按配置顺序排，order 递增且留出间隔', () => {
  const config = configOf({ sequence: [{ type: 'panel', id: 'personal-kit-usage' }, { type: 'panel', id: 'plugins' }] })
  const plan = buildPlan(config, LIVE)
  assert.deepEqual(plan.rows.slice(0, 2).map((row) => row.id), ['personal-kit-usage', 'plugins'])
  assert.ok(plan.panels.get('personal-kit-usage').order < plan.panels.get('plugins').order)
})

test('未安装的配置行被跳过，但不会从配置里消失', () => {
  const config = configOf({ sequence: [{ type: 'panel', id: 'ghost' }, { type: 'panel', id: 'plugins' }] })
  const plan = buildPlan(config, LIVE)
  assert.deepEqual(plan.rows.map((row) => row.id), ['plugins', 'schedules', 'dsh-context', 'personal-kit-usage'])
  assert.deepEqual(findOrphans(config, LIVE), ['ghost'])
})

test('隐藏只是标记，不改变这一行的存在', () => {
  const config = setPanelField(defaultConfig(), 'schedules', 'hidden', true)
  const plan = buildPlan(config, LIVE)
  assert.equal(plan.panels.get('schedules').hidden, true)
  assert.ok(plan.rows.some((row) => row.id === 'schedules'))
})

test('自定义名称与图标进入计划', () => {
  let config = setPanelField(defaultConfig(), 'plugins', 'label', '插件中心')
  config = setPanelField(config, 'plugins', 'icon', 'star')
  const plan = buildPlan(config, LIVE)
  assert.equal(plan.panels.get('plugins').label, '插件中心')
  assert.equal(plan.panels.get('plugins').icon, 'star')
})

test('清空覆盖项后回到插件自己的名称与图标', () => {
  let config = setPanelField(defaultConfig(), 'plugins', 'label', 'X')
  config = clearPanelOverride(config, 'plugins')
  const plan = buildPlan(config, LIVE)
  assert.equal(plan.panels.get('plugins').label, '插件')
  assert.equal(plan.panels.get('plugins').icon, null)
  assert.deepEqual(config.panels, {})
})

test('分组把成员收成一行，成员标记为已分组且隐藏', () => {
  const config = groupPanels(defaultConfig(), LIVE, ['dsh-context', 'personal-kit-usage'])
  const plan = buildPlan(config, LIVE)
  const groupRow = plan.rows.find((row) => row.kind === 'group')
  assert.ok(groupRow)
  assert.deepEqual(plan.groups.get(groupRow.id).members, ['dsh-context', 'personal-kit-usage'])
  for (const id of ['dsh-context', 'personal-kit-usage']) {
    assert.equal(plan.panels.get(id).grouped, true)
    assert.equal(plan.panels.get(id).hidden, true)
    assert.equal(plan.panels.get(id).groupId, groupRow.id)
  }
  // 分组行插在原先第一个成员的位置
  assert.deepEqual(plan.rows.map((row) => row.id), ['plugins', 'schedules', groupRow.id])
})

test('分组成员在计划里的下标排在分组行之后', () => {
  // 成员本身是隐藏的，但下标顺序决定了「更多」菜单里的排列，
  // 排在分组行前面会让菜单顺序看起来是随机的。
  const config = groupPanels(defaultConfig(), LIVE, ['dsh-context', 'personal-kit-usage'])
  const plan = buildPlan(config, LIVE)
  const groupRow = plan.rows.find((row) => row.kind === 'group')
  for (const id of ['dsh-context', 'personal-kit-usage']) {
    assert.ok(
      plan.panels.get(id).order > groupRow.order,
      `${id} (${plan.panels.get(id).order}) should sort after the group row (${groupRow.order})`,
    )
  }
})

test('不足两个面板时不建分组', () => {
  const config = groupPanels(defaultConfig(), LIVE, ['dsh-context'])
  assert.deepEqual(config.sequence.filter((row) => row.type === 'group'), [])
})

test('解散分组后成员回到顶层，顺序保持', () => {
  const grouped = groupPanels(defaultConfig(), LIVE, ['dsh-context', 'personal-kit-usage'])
  const groupId = grouped.sequence.find((row) => row.type === 'group').id
  const plan = buildPlan(ungroup(grouped, groupId), LIVE)
  assert.deepEqual(plan.rows.map((row) => row.id), ['plugins', 'schedules', 'dsh-context', 'personal-kit-usage'])
  assert.equal(plan.groups.size, 0)
})

test('把成员移出分组', () => {
  const grouped = groupPanels(defaultConfig(), LIVE, ['dsh-context', 'personal-kit-usage'])
  const groupId = grouped.sequence.find((row) => row.type === 'group').id
  const next = removeMember(grouped, groupId, 'dsh-context')
  const plan = buildPlan(next, LIVE)
  assert.deepEqual(plan.groups.get(groupId).members, ['personal-kit-usage'])
  assert.equal(plan.panels.get('dsh-context').grouped, false)
})

test('只剩一个成员时分组仍然存在，成员被移出后才消失', () => {
  const grouped = groupPanels(defaultConfig(), LIVE, ['dsh-context', 'personal-kit-usage'])
  const groupId = grouped.sequence.find((row) => row.type === 'group').id
  const one = removeMember(grouped, groupId, 'dsh-context')
  assert.equal(one.sequence.filter((row) => row.type === 'group').length, 1)
  const none = removeMember(one, groupId, 'personal-kit-usage')
  assert.equal(none.sequence.filter((row) => row.type === 'group').length, 0)
})

test('分组自己可以改名、换图标、整体隐藏', () => {
  const grouped = groupPanels(defaultConfig(), LIVE, ['dsh-context', 'personal-kit-usage'])
  const groupId = grouped.sequence.find((row) => row.type === 'group').id
  let config = setGroupField(grouped, groupId, 'label', '统计')
  config = setGroupField(config, groupId, 'icon', 'chart')
  config = setGroupField(config, groupId, 'hidden', true)
  const plan = buildPlan(config, LIVE)
  assert.equal(plan.groups.get(groupId).label, '统计')
  assert.equal(plan.groups.get(groupId).icon, 'chart')
  assert.equal(plan.groups.get(groupId).hidden, true)
})

test('上移与下移在边界处不动', () => {
  let config = materialize(defaultConfig(), LIVE)
  const first = config.sequence[0].id
  assert.deepEqual(moveRow(config, LIVE, first, -1).sequence.map((row) => row.id), config.sequence.map((row) => row.id))
  const last = config.sequence[config.sequence.length - 1].id
  assert.deepEqual(moveRow(config, LIVE, last, 1).sequence.map((row) => row.id), config.sequence.map((row) => row.id))
  assert.deepEqual(moveRow(config, LIVE, first, 1).sequence.map((row) => row.id)[1], first)
})

test('拖拽到目标行之前（向上与向下都正确）', () => {
  const config = materialize(defaultConfig(), LIVE)
  const up = moveRowBefore(config, LIVE, 'personal-kit-usage', 'plugins')
  assert.deepEqual(up.sequence.map((row) => row.id), ['personal-kit-usage', 'plugins', 'schedules', 'dsh-context'])
  const down = moveRowBefore(config, LIVE, 'plugins', 'schedules')
  assert.deepEqual(down.sequence.map((row) => row.id), ['schedules', 'plugins', 'dsh-context', 'personal-kit-usage'])
})

test('拖到自己身上不改变任何东西', () => {
  const config = materialize(defaultConfig(), LIVE)
  assert.deepEqual(moveRowBefore(config, LIVE, 'plugins', 'plugins'), config)
})

test('移除未安装的配置行会同时清掉它的覆盖项', () => {
  const config = configOf({ sequence: [{ type: 'panel', id: 'ghost' }], panels: { ghost: { hidden: true } } })
  const next = removePanelRow(config, 'ghost')
  assert.deepEqual(next.sequence, [])
  assert.deepEqual(next.panels, {})
})

test('孤儿面板的覆盖项不会外溢到已安装的面板上', () => {
  const config = configOf({ sequence: [{ type: 'panel', id: 'ghost' }], panels: { ghost: { icon: 'star' } } })
  const plan = buildPlan(config, LIVE)
  assert.equal(plan.panels.get('plugins').icon, null)
})
