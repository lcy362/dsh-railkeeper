/**
 * dsh-railkeeper —— 宿主侧 loopback API。
 *
 * 端点（全部挂在 `/railkeeper/api` 前缀下）：
 *   GET  /health         环境与存储健康
 *   GET  /config         当前 profile 的配置
 *   PUT  /config         保存配置（body: { config }）
 *   POST /config/reset   恢复默认配置
 *   POST /client-status  浏览器半区上报现场（诊断用，内存保留最近 50 条）
 *   GET  /client-status  读取最近的上报
 *   GET  /legacy         读取 dsh-panellist 的旧配置并转换形状（迁移用）
 *
 * 三层准入，缺一不可：
 *
 *   1. **DSH 的信任栅栏**（`ctx.connection.requestRejection`，见 ../host/index.js）。
 *      `webServer.register` 挂上的路由不经过 DSH 自己的 Host/Origin 准入，所以
 *      插件必须主动去问它。这一层是权威判据。
 *   2. **本地兜底**（`isLoopbackRequest`）：socket 对端是回环，且 Host 头是回环
 *      权威。为什么不能只比 Origin 与 Host：DNS rebinding 之后两者会一起变成
 *      攻击者的域名，比较相等反而通过；要求 Host 是回环才真的挡住。
 *   3. **写请求必须是 JSON**（`isJsonRequest`）：浏览器对 application/json 会先
 *      发预检，跨站表单无法自带这个头，于是简单请求类 CSRF 被挡在外面。
 *
 * 对 401 与 403 区别对待：403 是 Host/Origin 栅栏拒绝；401 是"可信但未认证"。
 * 桌面端页面由 `dsh-app://` 协议加载，与 127.0.0.1 不同源，它的 fetch 不一定
 * 带得上 auth cookie —— 一律按 401 拒会把界面读数整个掐死，所以 401 交给第 2
 * 层判（跨站形态仍被第 2 层挡住）。
 */
import { SCHEMA_VERSION } from '../shared/config.js'

/** 前缀路由路径。 */
export const API_PREFIX = '/railkeeper/api'

const MAX_CONFIG_BODY = 1024 * 1024
const MAX_STATUS_BODY = 256 * 1024
const MAX_STATUS_RECORDS = 50
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

/** @param {unknown} value */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 从 Host / Origin 头里取主机名（去掉端口和 IPv6 方括号）。
 * @param {string} authority
 */
function hostnameOf(authority) {
  const value = authority.trim().toLowerCase()
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end === -1 ? '' : value.slice(1, end)
  }
  const first = value.indexOf(':')
  if (first === -1) return value
  return first === value.lastIndexOf(':') ? value.slice(0, first) : value
}

/**
 * 该请求是否来自本机回环。
 * @param {import('node:http').IncomingMessage} req
 */
function isLoopbackRequest(req) {
  const address = req.socket?.remoteAddress
  if (address === undefined || !LOOPBACK_ADDRESSES.has(address)) return false
  const host = req.headers.host
  if (typeof host !== 'string' || host.length === 0) return false
  return LOOPBACK_HOSTS.has(hostnameOf(host))
}

/**
 * 写请求的来源校验：没有 Origin（桌面 IPC 桥）或 Origin 为 null 时放行，
 * 其它情况必须与 Host 完全同源。
 * @param {import('node:http').IncomingMessage} req
 */
function hasSameOrigin(req) {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin.length === 0 || origin === 'null') return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

/**
 * 写请求是否声明了 JSON 请求体。
 *
 * 浏览器对 `application/json` 会先发预检，跨站表单无法伪造这个头，所以
 * "必须声明 JSON"本身就是一条 CSRF 防线（简单请求类）。
 * @param {import('node:http').IncomingMessage} req
 */
function isJsonRequest(req) {
  const raw = req.headers['content-type']
  if (typeof raw !== 'string') return false
  return raw.split(';')[0].trim().toLowerCase() === 'application/json'
}

/**
 * 读取请求体并解析为 JSON。
 * @param {import('node:http').IncomingMessage} req
 * @param {number} cap
 * @returns {Promise<unknown>}
 */
function readJsonBody(req, cap) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = []
    let size = 0
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > cap) {
        fail(Object.assign(new Error('body too large'), { statusCode: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      try {
        const text = Buffer.concat(chunks).toString('utf8').trim()
        resolve(text.length === 0 ? undefined : JSON.parse(text))
      } catch {
        reject(Object.assign(new Error('body is not valid JSON'), { statusCode: 400 }))
      }
    })
    req.on('error', fail)
  })
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function respondJson(res, status, body) {
  const text = `${JSON.stringify(body)}\n`
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  })
  res.end(text)
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string} error
 * @param {string[]} [details]
 */
function respondError(res, status, error, details) {
  respondJson(res, status, {
    ok: false,
    error,
    ...(details === undefined || details.length === 0 ? {} : { details }),
  })
}

/**
 * 创建前缀路由处理函数。
 * @param {import('./store.js').ConfigStore} store
 */
export function createApiHandler(store, hooks = {}) {
  /** @type {Array<Record<string, unknown>>} */
  const clientRecords = []

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  return function handle(req, res) {
    void (async () => {
      // 第 1 层：DSH 自己的信任栅栏（web carrier 在时才有）。
      // `webServer.register` 挂的路由不经过 DSH 的准入，所以必须主动问一次。
      if (typeof hooks.requestRejection === 'function') {
        let rejection
        try {
          rejection = hooks.requestRejection(req)
        } catch {
          rejection = undefined
        }
        if (rejection === 403) {
          respondError(res, 403, 'request rejected')
          return
        }
        // 401（可信但未认证）不在此拒绝：见文件头说明，交给第 2 层。
      }
      // 第 2 层：本地兜底（回环对端 + 回环 Host）。
      if (!isLoopbackRequest(req)) {
        respondError(res, 403, 'loopback access only')
        return
      }
      // 第 3 层：写请求必须声明 JSON。
      const rawMethod = (req.method ?? 'GET').toUpperCase()
      if ((rawMethod === 'POST' || rawMethod === 'PUT') && !isJsonRequest(req)) {
        respondError(res, 415, 'content-type must be application/json')
        return
      }
      let url
      try {
        url = new URL(req.url ?? '/', 'http://localhost')
      } catch {
        respondError(res, 400, 'bad request target')
        return
      }
      let pathname = url.pathname
      if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1)
      const method = (req.method ?? 'GET').toUpperCase()

      if (pathname === `${API_PREFIX}/health` && method === 'GET') {
        respondJson(res, 200, { ok: true, ...store.health(), schemaVersion: SCHEMA_VERSION })
        return
      }

      if (pathname === `${API_PREFIX}/config` && method === 'GET') {
        const result = await store.read()
        respondJson(res, 200, {
          ok: true,
          profileId: store.profileId,
          config: result.config,
          health: result.health,
        })
        return
      }

      if (pathname === `${API_PREFIX}/config` && (method === 'PUT' || method === 'POST')) {
        if (!hasSameOrigin(req)) {
          respondError(res, 403, 'cross-origin write rejected')
          return
        }
        const body = await readJsonBody(req, MAX_CONFIG_BODY)
        if (!isRecord(body) || body.config === undefined) {
          respondError(res, 400, 'body must be { config }')
          return
        }
        try {
          const saved = await store.write(body.config)
          respondJson(res, 200, { ok: true, profileId: store.profileId, ...saved })
        } catch (error) {
          const details = isRecord(error) && Array.isArray(error.details) ? error.details : []
          respondError(res, 400, error instanceof Error ? error.message : 'invalid config', details)
        }
        return
      }

      if (pathname === `${API_PREFIX}/config/reset` && method === 'POST') {
        if (!hasSameOrigin(req)) {
          respondError(res, 403, 'cross-origin write rejected')
          return
        }
        const reset = await store.reset()
        respondJson(res, 200, { ok: true, profileId: store.profileId, ...reset })
        return
      }

      if (pathname === `${API_PREFIX}/legacy` && method === 'GET') {
        const legacy = await store.readLegacy()
        respondJson(res, 200, { ok: true, ...legacy })
        return
      }

      if (pathname === `${API_PREFIX}/client-status` && method === 'POST') {
        if (!hasSameOrigin(req)) {
          respondError(res, 403, 'cross-origin write rejected')
          return
        }
        const body = await readJsonBody(req, MAX_STATUS_BODY)
        if (!isRecord(body)) {
          respondError(res, 400, 'status must be an object')
          return
        }
        clientRecords.unshift({
          ...body,
          receivedAt: new Date().toISOString(),
          profileId: store.profileId,
        })
        if (clientRecords.length > MAX_STATUS_RECORDS) clientRecords.length = MAX_STATUS_RECORDS
        respondJson(res, 200, { ok: true, count: clientRecords.length })
        return
      }

      if (pathname === `${API_PREFIX}/client-status` && method === 'GET') {
        respondJson(res, 200, { ok: true, records: clientRecords })
        return
      }

      respondError(res, 404, `unknown endpoint ${pathname}`)
    })().catch((error) => {
      if (res.headersSent) {
        res.end()
        return
      }
      const status = isRecord(error) && typeof error.statusCode === 'number' ? error.statusCode : 500
      respondError(res, status, error instanceof Error ? error.message : 'internal error')
    })
  }
}