/**
 * 弹出菜单的摆放计算。全是纯函数，边界（贴边、翻转、越界）都在这里钉死。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { MENU_GAP, MENU_MARGIN, placeMenu } from '../src/client/menu.js'

const VIEWPORT = { width: 1200, height: 800 }
const MENU = { width: 200, height: 160 }
/** 侧栏里一行的大致位置。 */
const row = (top, left = 12) => ({ top, left, width: 224, height: 32 })

test('右侧放得下时放在右边', () => {
  const placed = placeMenu(row(300), MENU, VIEWPORT)
  assert.equal(placed.left, 12 + 224 + MENU_GAP)
  assert.equal(placed.top, 300)
  assert.equal(placed.flippedX, false)
})

test('右侧放不下时翻到左边', () => {
  // 行贴在视口右边：右边只剩 10px，不够 200px
  const placed = placeMenu({ top: 300, left: 990, width: 200, height: 32 }, MENU, VIEWPORT)
  assert.equal(placed.flippedX, true)
  assert.ok(placed.left + MENU.width <= 990 - MENU_GAP)
})

test('两侧都放不下的窄视口里仍然留在视口内', () => {
  const placed = placeMenu(row(300, 60), MENU, { width: 320, height: 800 })
  assert.ok(placed.left >= MENU_MARGIN)
  assert.ok(placed.left + MENU.width <= 320 - MENU_MARGIN)
})

test('下方空间不足时向上收，且不越出顶边', () => {
  const placed = placeMenu(row(770), MENU, VIEWPORT)
  assert.equal(placed.flippedY, true)
  assert.ok(placed.top >= MENU_MARGIN)
  assert.ok(placed.top + MENU.height <= 770 + 32)
})

test('菜单比视口还高时夹在顶边，不会算出负坐标', () => {
  const placed = placeMenu(row(300), { width: 200, height: 2000 }, VIEWPORT)
  assert.equal(placed.top, MENU_MARGIN)
})

test('菜单比视口还宽时夹在左边，不会算出负坐标', () => {
  const placed = placeMenu(row(300), { width: 5000, height: 160 }, VIEWPORT)
  assert.equal(placed.left, MENU_MARGIN)
})

test('贴顶的行不会把菜单推到视口外', () => {
  const placed = placeMenu(row(0), MENU, VIEWPORT)
  assert.ok(placed.top >= MENU_MARGIN)
})

test('视口左上角的行：菜单落在它右下', () => {
  const placed = placeMenu({ top: 0, left: 0, width: 224, height: 32 }, MENU, VIEWPORT)
  assert.ok(placed.left > 0)
  assert.ok(placed.top >= MENU_MARGIN)
})
