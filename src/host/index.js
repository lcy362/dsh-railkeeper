/**
 * dsh-railkeeper —— 宿主半区入口。
 *
 * 只做两件事：建配置存储、把 loopback API 挂到 webServer 上。
 * 不依赖任何硬服务；profile 没有 webServer 时插件保持静默（界面半区会
 * 显示“宿主不可用”而不是整包失败）。
 */
import { ConfigStore } from './store.js'
import { API_PREFIX, createApiHandler } from './routes.js'

/** 与 `cordis.patch.yml` 中的行 id 一致。 */
export const name = 'dsh-railkeeper'

/** 不声明硬依赖：webServer 通过 ctx.inject 按需接线。 */
export const inject = []

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ home?: string, profileId?: string } | undefined} config
 */
export function apply(ctx, config) {
  const store = new ConfigStore({
    home: config?.home,
    profileId: config?.profileId,
  })
  const handler = createApiHandler(store)

  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.reflect.get('webServer')
    if (webServer === undefined) return
    webCtx.effect(
      () => webServer.register({ kind: 'prefix', path: API_PREFIX, handler }),
      'dsh-railkeeper: loopback api route',
    )
  })
}