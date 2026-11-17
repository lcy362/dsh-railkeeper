/**
 * dsh-railkeeper —— 宿主半区入口。
 *
 * 做三件事：建配置存储、取到 DSH 的浏览器信任栅栏、把 API 挂到 webServer 上。
 * 不声明硬依赖；profile 没有 webServer 时插件保持静默（界面半区会显示
 * “宿主不可用”而不是整包失败），没有 connection 时路由退回自己的本地判据。
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
  /**
   * DSH 的浏览器信任栅栏（`ctx.connection.requestRejection`）。
   *
   * 为什么必须主动取：`webServer.register` 挂上的路由**不经过** DSH 自己的
   * Host/Origin 准入，所以插件得自己去问一次。官方 web 面插件
   * （dsh-host-open-in-app）把 connection 声明成硬依赖；这里按可选服务取，
   * 保留本插件“缺服务只降级、不整个加载失败”的性质 —— 没有 connection 就是
   * 没有 web carrier，也就没有浏览器请求需要防。
   */
  let connectionService
  ctx.inject(['connection'], (scope) => {
    try {
      const service = scope.get('connection')
      if (service !== undefined && service !== null) connectionService = service
    } catch {
      connectionService = undefined
    }
  })

  /**
   * 问 DSH 这道栅栏放不放行。
   * @param {import('node:http').IncomingMessage} req
   * @returns {number | undefined} 非 undefined 表示应以此状态码拒绝
   */
  function requestRejection(req) {
    const service = connectionService
    if (service === undefined || typeof service.requestRejection !== 'function') return undefined
    try {
      return service.requestRejection(req)
    } catch {
      return undefined
    }
  }

  const handler = createApiHandler(store, { requestRejection })

  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.reflect.get('webServer')
    if (webServer === undefined) return
    webCtx.effect(
      () => webServer.register({ kind: 'prefix', path: API_PREFIX, handler }),
      'dsh-railkeeper: loopback api route',
    )
  })
}