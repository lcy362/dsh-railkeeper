/**
 * dsh-railkeeper —— 弹出菜单的摆放计算（纯函数）。
 *
 * 分组行点开后要在它旁边弹一个成员列表。菜单尺寸和触发元素的位置都只有运行时
 * 才知道，所以这里只做一件事：给定两者的矩形和视口大小，算出左上角坐标，
 * 保证菜单不越出视口。抽成纯函数是因为这部分最容易算错（贴边、翻转），
 * 而且不需要浏览器就能测。
 */

/** 菜单与触发元素之间的间距。 */
export const MENU_GAP = 6
/** 菜单距视口边缘的最小留白。 */
export const MENU_MARGIN = 8

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
export function placeMenu(anchor, menu, viewport) {
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
