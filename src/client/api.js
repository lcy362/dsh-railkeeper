/**
 * dsh-railkeeper —— 宿主 API 客户端。
 *
 * 所有请求都是相对路径：桌面版由 Electron 的 fetch 桥接转发到本机 webServer，
 * 浏览器版就是同源请求。写请求带 JSON body，不做任何凭据处理。
 */

const BASE = '/railkeeper/api'

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * @param {string} path
 * @param {{ method?: string, body?: unknown, timeoutMs?: number }} [options]
 */
async function request(path, options = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined
  const timer = controller === undefined
    ? undefined
    : setTimeout(() => controller.abort(), options.timeoutMs ?? 6000)
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller?.signal,
    })
  } catch (error) {
    throw Object.assign(new Error(messageOf(error)), { code: 'network' })
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
  const text = await response.text()
  let payload
  try {
    payload = text.length === 0 ? undefined : JSON.parse(text)
  } catch {
    payload = undefined
  }
  if (!response.ok) {
    const detail = payload !== undefined && typeof payload === 'object' && typeof payload.error === 'string'
      ? payload.error
      : `HTTP ${response.status}`
    const error = new Error(detail)
    // @ts-expect-error 诊断字段
    error.status = response.status
    // @ts-expect-error 诊断字段
    error.details = payload?.details
    throw error
  }
  return payload
}

/** @param {unknown} error */
export function describeApiError(error) {
  if (error instanceof Error && error.message.length > 0) return error.message
  return String(error)
}

export function createApi() {
  return {
    async load() {
      return request('/config')
    },
    async save(config) {
      return request('/config', { method: 'PUT', body: { config } })
    },
    async reset() {
      return request('/config/reset', { method: 'POST', body: {} })
    },
    /** 失败静默：诊断上报不能影响界面。 */
    report(payload) {
      try {
        void request('/client-status', { method: 'POST', body: payload, timeoutMs: 2500 }).catch(() => {})
      } catch {
        // ignore
      }
    },
    async clientStatus() {
      return request('/client-status')
    },
    /** 读取旧插件 dsh-panellist 的配置并转换为本插件结构。 */
    async legacy() {
      return request('/legacy')
    },
  }
}