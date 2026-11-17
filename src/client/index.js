/**
 * dsh-railkeeper —— 浏览器半区入口。
 *
 * 只声明 `slots` 一个硬依赖；locale / layout 都按需取，缺了不影响整包加载。
 * 先读宿主配置，再启动侧栏改写，避免先用空配置覆盖一帧顺序。
 */
import { createApi } from './api.js'
import { createI18n } from './i18n.js'
import { createRailController } from './rail.js'
import { createSettingsComponent } from './settings.js'
import { createConfigStore } from './store.js'

/** 与 package.json 对齐；客户端改动时同步递增后缀，便于从 /client-status 确认现场版本。 */
export const CLIENT_VERSION = '0.1.2+client.36'

export const name = 'dsh-railkeeper'

/** 只要求 slots；其余服务都走容错读取。 */
export const inject = ['slots']

/**
 * @param {any} ctx
 */
export function apply(ctx) {
  const api = createApi()
  const i18n = createI18n(ctx)
  const store = createConfigStore(api, i18n)
  const rail = createRailController({ ctx, store, i18n, api, version: CLIENT_VERSION })
  const SettingsSection = createSettingsComponent({ store, rail, i18n, api })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'railkeeper',
    order: 120,
    label: () => i18n.t('section.label'),
  }, SettingsSection))

  ctx.effect(() => () => {
    rail.dispose()
    store.dispose()
    i18n.dispose()
  })

  const announce = (kind) => {
    api.report({
      version: CLIENT_VERSION,
      kind,
      locale: i18n.lang(),
      slots: ['settings.section', 'sidebar.panellist', 'main']
        .filter((slot) => {
          try {
            return ctx.slots.entriesOfSlot(slot).length > 0
          } catch {
            return false
          }
        }),
      hasLayout: (() => {
        try {
          return ctx.get('layout') !== undefined
        } catch {
          return false
        }
      })(),
      // 平台 seed 有没有真的给出 createPortal：弹出菜单能不能挂到 body 全看它
      portalResolved: rail.portalResolved(),
    })
  }

  announce('apply')
  store.load().then(() => {
    rail.start()
    announce('ready')
  }).catch((error) => {
    rail.start()
    api.report({
      version: CLIENT_VERSION,
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  })
}