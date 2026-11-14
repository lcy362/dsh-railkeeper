/**
 * dsh-railkeeper —— 内置图标。
 *
 * 全部是 16×16 线条稿，`stroke="currentColor"`，沿用内核侧栏图标的观感。
 * 这里不引用任何 Harness 客户端包，避免内核升级时命名导出消失把入口打崩。
 */
import * as React from 'react'
import { BUILTIN_ICONS } from '../shared/config.js'

const h = React.createElement

/** @type {Record<string, Array<[string, Record<string, unknown>]>>} */
const SHAPES = {
  grid: [
    ['rect', { x: 2.5, y: 2.5, width: 4.6, height: 4.6, rx: 1 }],
    ['rect', { x: 8.9, y: 2.5, width: 4.6, height: 4.6, rx: 1 }],
    ['rect', { x: 2.5, y: 8.9, width: 4.6, height: 4.6, rx: 1 }],
    ['rect', { x: 8.9, y: 8.9, width: 4.6, height: 4.6, rx: 1 }],
  ],
  puzzle: [
    ['path', { d: 'M3 3h4.2v1.6a1.8 1.8 0 1 0 1.6 0V3H13v4.2h-1.6a1.8 1.8 0 1 0 0 1.6H13V13H8.8v-1.6a1.8 1.8 0 1 0-1.6 0V13H3V8.8h1.6a1.8 1.8 0 1 0 0-1.6H3z' }],
  ],
  sparkles: [
    ['path', { d: 'M6 2.2l.9 2.4 2.4.9-2.4.9L6 8.8l-.9-2.4-2.4-.9 2.4-.9z' }],
    ['path', { d: 'M11.4 8.3l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z' }],
  ],
  clock: [
    ['circle', { cx: 8, cy: 8, r: 5.8 }],
    ['path', { d: 'M8 4.6V8l2.6 1.8' }],
  ],
  terminal: [
    ['rect', { x: 1.8, y: 3, width: 12.4, height: 10, rx: 1.4 }],
    ['path', { d: 'M4.6 6.4l2.2 2.2-2.2 2.2' }],
    ['path', { d: 'M9 11h2.8' }],
  ],
  plug: [
    ['path', { d: 'M5.6 2v3.4M10.4 2v3.4' }],
    ['path', { d: 'M3.6 5.4h8.8v2.2a4.4 4.4 0 0 1-8.8 0z' }],
    ['path', { d: 'M8 12v2.2' }],
  ],
  star: [
    ['path', { d: 'M8 2.4l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11.1 4.6 12.9l.7-3.8L2.5 6.4l3.8-.5z' }],
  ],
  folder: [
    ['path', { d: 'M1.8 12.6V4.2a1 1 0 0 1 1-1h3.1l1.4 1.9h5.9a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z' }],
  ],
  book: [
    ['path', { d: 'M8 4.3C6.9 3.4 5.6 3 3 3v9.3c2.6 0 3.9.5 5 1.4 1.1-.9 2.4-1.4 5-1.4V3c-2.6 0-3.9.4-5 1.3z' }],
    ['path', { d: 'M8 4.3v9.4' }],
  ],
  code: [
    ['path', { d: 'M6.2 4.6L2.6 8l3.6 3.4M9.8 4.6L13.4 8l-3.6 3.4' }],
    ['path', { d: 'M9.2 2.8l-2.4 10.4' }],
  ],
  gear: [
    ['circle', { cx: 8, cy: 8, r: 2.2 }],
    ['path', { d: 'M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2' }],
    ['circle', { cx: 8, cy: 8, r: 5.6 }],
  ],
  chart: [
    ['path', { d: 'M2.4 13.4h11.2' }],
    ['path', { d: 'M4.8 13.4V9.2M8 13.4V5.4M11.2 13.4v-2.6' }],
  ],
  list: [
    ['circle', { cx: 2.7, cy: 3.6, r: 0.7, filled: true }],
    ['circle', { cx: 2.7, cy: 8, r: 0.7, filled: true }],
    ['circle', { cx: 2.7, cy: 12.4, r: 0.7, filled: true }],
    ['path', { d: 'M5.6 3.6h8.2M5.6 8h8.2M5.6 12.4h8.2' }],
  ],
  bell: [
    ['path', { d: 'M4.4 12.4V8.4a3.6 3.6 0 0 1 7.2 0v4z' }],
    ['path', { d: 'M6.8 14.1a1.3 1.3 0 0 0 2.4 0' }],
    ['path', { d: 'M8 4.8V3.2' }],
  ],
  bolt: [
    ['path', { d: 'M9 1.8L4 9h3.3l-.6 5.2L12 7h-3.3z' }],
  ],
  shield: [
    ['path', { d: 'M8 2.1l5.5 2.1v4c0 2.8-2.3 5-5.5 6-3.2-1-5.5-3.2-5.5-6v-4z' }],
    ['path', { d: 'M5.9 8l1.5 1.5L10.3 6.6' }],
  ],
  globe: [
    ['circle', { cx: 8, cy: 8, r: 5.8 }],
    ['ellipse', { cx: 8, cy: 8, rx: 2.6, ry: 5.8 }],
    ['path', { d: 'M2.2 8h11.6' }],
  ],
  database: [
    ['ellipse', { cx: 8, cy: 4.4, rx: 5.3, ry: 2 }],
    ['path', { d: 'M2.7 4.4v7c0 1.1 2.4 2 5.3 2s5.3-.9 5.3-2v-7' }],
    ['path', { d: 'M2.7 7.9c0 1.1 2.4 2 5.3 2s5.3-.9 5.3-2' }],
  ],
  box: [
    ['path', { d: 'M8 1.8l5.7 3v6.4L8 14.2l-5.7-3V4.8z' }],
    ['path', { d: 'M2.3 4.8L8 7.8l5.7-3M8 7.8v6.4' }],
  ],
  wrench: [
    ['path', { d: 'M10.1 2.2a3.6 3.6 0 0 0-4.7 4.6l-3.9 3.9a1.4 1.4 0 0 0 2 2l3.9-3.9a3.6 3.6 0 0 0 4.6-4.7l-2.1 2.1-1.9-.6-.6-1.9z' }],
  ],
  layers: [
    ['path', { d: 'M8 1.8l5.7 3L8 7.8 2.3 4.8z' }],
    ['path', { d: 'M2.3 8.2L8 11.2l5.7-3' }],
    ['path', { d: 'M2.3 11.4L8 14.4l5.7-3' }],
  ],
  compass: [
    ['circle', { cx: 8, cy: 8, r: 5.8 }],
    ['path', { d: 'M10.4 5.6L8.8 8.8 5.6 10.4l1.6-3.2z' }],
  ],
  chat: [
    ['path', { d: 'M2.2 7.6c0-2.7 2.6-4.9 5.8-4.9s5.8 2.2 5.8 4.9-2.6 4.9-5.8 4.9c-.7 0-1.4-.1-2-.3l-2.9 1.2.9-2.5a4.7 4.7 0 0 1-1.8-3.3z' }],
  ],
  home: [
    ['path', { d: 'M2.6 7.4L8 2.6l5.4 4.8' }],
    ['path', { d: 'M4 6.8v6.6h8V6.8' }],
    ['path', { d: 'M6.5 13.4V9.8h3v3.6' }],
  ],
}

/** 已注册的图标名（与配置校验共用一份名单）。 */
export const ICON_NAMES = BUILTIN_ICONS

/**
 * 渲染一个内置图标。
 * @param {{ name?: string, size?: number, active?: boolean, className?: string }} props
 */
export function Glyph({ name, size = 16, active = false, className }) {
  const shapes = SHAPES[name] ?? SHAPES.grid
  return h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.25,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
      className,
      'data-railkeeper-glyph': name ?? 'grid',
      ...(active ? { 'data-railkeeper-glyph-active': '' } : {}),
    },
    shapes.map(([tag, attrs], index) => {
      const filled = attrs.filled === true
      const { filled: _filled, ...rest } = attrs
      return h(tag, {
        key: `${name ?? 'grid'}-${index}`,
        ...rest,
        ...(filled ? { fill: 'currentColor', stroke: 'none' } : {}),
      })
    }),
  )
}

/**
 * 给 CSS/图标选择器用的 data URI（黑稿，靠 mask 或 img 着色）。
 * @param {string} name
 */
export function glyphDataUri(name) {
  const shapes = SHAPES[name] ?? SHAPES.grid
  const body = shapes.map(([tag, attrs]) => {
    const clean = Object.entries(attrs)
      .filter(([key]) => key !== 'filled')
      .map(([key, value]) => `${key}="${String(value)}"`)
      .join(' ')
    const fill = attrs.filled === true ? ' fill="black" stroke="none"' : ''
    return `<${tag} ${clean}${fill}/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="black" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}