/**
 * dsh-railkeeper —— 宿主侧配置存储。
 *
 * 一个 JSON 文档，放在 `$DSH_HOME/railkeeper.json`，按 profile 分节：
 *
 *   { "schemaVersion": 1, "profiles": { "default": { ...配置... } } }
 *
 * 读写原则：
 * - 读永远不抛：文件缺失 → 默认配置；损坏 → 先备份 `.corrupt-*` 再回默认。
 * - 写先归一化并拒绝非法输入；同目录临时文件 + rename 原子替换，权限 0600。
 * - 只保存“用户配置”，不缓存运行时面板集合。
 */
import { chmod, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { SCHEMA_VERSION, defaultConfig, isBuiltinIcon, normalizeConfig } from '../shared/config.js'

/** 配置文件名（位于 DSH home 根目录）。 */
export const CONFIG_FILE_NAME = 'railkeeper.json'

/**
 * 解析 DSH home：显式配置 > `$DSH_HOME` > `~/.dsh`。
 * 空白值视为未设置，绝不把 home 解析成当前工作目录。
 * @param {string | undefined} configured
 */
export function resolveDshHome(configured) {
  const explicit = typeof configured === 'string' && configured.trim().length > 0
    ? configured.trim()
    : undefined
  const fromEnv = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim().length > 0
    ? process.env.DSH_HOME.trim()
    : undefined
  const chosen = explicit ?? fromEnv
  return chosen === undefined ? join(homedir(), '.dsh') : resolve(chosen)
}

/**
 * 解析当前 profile id：显式配置 > `$DSH_PROFILE` > `default`。
 * @param {string | undefined} configured
 */
export function resolveProfileId(configured) {
  const explicit = typeof configured === 'string' && configured.trim().length > 0
    ? configured.trim()
    : undefined
  const fromEnv = typeof process.env.DSH_PROFILE === 'string' && process.env.DSH_PROFILE.trim().length > 0
    ? process.env.DSH_PROFILE.trim()
    : undefined
  return explicit ?? fromEnv ?? 'default'
}

/** @param {unknown} value */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param {unknown} error */
function isNotFound(error) {
  return Boolean(error) && typeof error === 'object' && error.code === 'ENOENT'
}

/** @param {unknown} error */
function describe(error) {
  return error instanceof Error ? error.message : String(error)
}

export class ConfigStore {
  /**
   * @param {{ home?: string, profileId?: string }} [options]
   */
  constructor(options = {}) {
    this.home = resolveDshHome(options.home)
    this.profileId = resolveProfileId(options.profileId)
    this.configPath = join(this.home, CONFIG_FILE_NAME)
    /** @type {{ exists: boolean, writable: boolean, lastError: string | undefined, corruption: { detected: boolean, backupPath: string | undefined }, warnings: string[] }} */
    this.status = { exists: false, writable: true, lastError: undefined, corruption: { detected: false, backupPath: undefined }, warnings: [] }
  }

  /** 给客户端看的环境信息（不含任何凭据）。 */
  health() {
    return {
      ok: this.status.lastError === undefined,
      profileId: this.profileId,
      configPath: this.configPath,
      schemaVersion: SCHEMA_VERSION,
      exists: this.status.exists,
      writable: this.status.writable,
      corruption: { ...this.status.corruption },
      warnings: [...this.status.warnings],
      checkedAt: new Date().toISOString(),
    }
  }

  /** 尽力读取整份文档；损坏时返回空对象（不抛）。 */
  async readDocument() {
    try {
      const raw = await readFile(this.configPath, 'utf8')
      const parsed = JSON.parse(raw)
      if (!isRecord(parsed)) throw new Error('document root is not an object')
      return parsed
    } catch (error) {
      if (isNotFound(error)) return {}
      if (error instanceof SyntaxError || describe(error).includes('document root')) {
        await this.quarantine()
      } else {
        this.status.lastError = describe(error)
      }
      return {}
    }
  }

  /** 把损坏文件复制到旁边，保留现场。 */
  async quarantine() {
    const backupPath = `${this.configPath}.corrupt-${Date.now()}`
    try {
      await copyFile(this.configPath, backupPath)
      this.status.corruption = { detected: true, backupPath }
    } catch (error) {
      this.status.lastError = describe(error)
    }
  }

  /**
   * 读取当前 profile 的配置。
   * @returns {Promise<{ config: ReturnType<typeof defaultConfig>, health: ReturnType<ConfigStore['health']> }>}
   */
  async read() {
    this.status.lastError = undefined
    this.status.warnings = []
    const document = await this.readDocument()
    const section = isRecord(document) && isRecord(document.profiles)
      ? document.profiles[this.profileId]
      : undefined
    if (section === undefined) {
      this.status.exists = Object.keys(document).length > 0
      return { config: defaultConfig(), health: this.health() }
    }
    this.status.exists = true
    const normalized = normalizeConfig(section)
    if (!normalized.ok) {
      this.status.warnings = normalized.errors.slice(0, 20)
    }
    return { config: normalized.config, health: this.health() }
  }

  /**
   * 写入当前 profile 的配置；非法输入直接拒绝，不落盘。
   * @param {unknown} candidate
   */
  async write(candidate) {
    const normalized = normalizeConfig(candidate)
    if (!normalized.ok) {
      const error = new Error(`invalid railkeeper config: ${normalized.errors[0] ?? 'unknown error'}`)
      // @ts-expect-error 附带细节给路由层
      error.details = normalized.errors
      throw error
    }
    const document = await this.readDocument()
    const profiles = isRecord(document.profiles) ? document.profiles : {}
    // 版本号只写在文档根上：profile 分节只放 sequence/panels，
    // 免得同一个字段两处各写一份、日后互相漂移。
    const { schemaVersion: _sectionVersion, ...section } = normalized.config
    const next = {
      ...document,
      schemaVersion: SCHEMA_VERSION,
      profiles: { ...profiles, [this.profileId]: section },
    }
    await mkdir(dirname(this.configPath), { recursive: true })
    const temporary = `${this.configPath}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, this.configPath)
    await chmod(this.configPath, 0o600).catch(() => {})
    this.status.exists = true
    this.status.writable = true
    this.status.lastError = undefined
    return { config: normalized.config, health: this.health() }
  }

  /** 恢复默认配置（空序列、无覆盖）。 */
  async reset() {
    return this.write(defaultConfig())
  }

  /**
   * 读取旧插件 dsh-panellist 的配置并转换成本插件的结构。
   *
   * 很多用户是从 panellist 迁过来的，两个插件的配置形状接近但不兼容
   * （`sequence` 里的 `{type:'entry'}` 对应这边的 `{type:'panel'}`，
   * 覆盖项放在 `entries` 而不是 `panels`）。这里只做形状转换：
   * 认不出的图标名字直接丢掉，宁可少一个图标，也不要写进一个渲染不出来的值。
   *
   * @returns {Promise<{ found: boolean, config: ReturnType<typeof defaultConfig> | null, warnings: string[] }>}
   */
  async readLegacy() {
    const legacyPath = join(this.home, 'panellist.json')
    /** @type {string[]} */
    const warnings = []
    let raw
    try {
      raw = await readFile(legacyPath, 'utf8')
    } catch {
      return { found: false, config: null, warnings }
    }
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { found: true, config: null, warnings: ['panellist.json is not valid JSON'] }
    }
    const section = isRecord(parsed) && isRecord(parsed.profiles)
      ? parsed.profiles[this.profileId]
      : undefined
    if (section === undefined) {
      return { found: true, config: null, warnings: [`panellist.json has no section for profile "${this.profileId}"`] }
    }

    /** @type {Array<Record<string, unknown>>} */
    const sequence = []
    const legacyIcons = isRecord(section.entries) ? section.entries : {}
    const seen = new Set()
    const iconOf = (id) => {
      const entry = legacyIcons[id]
      return entry !== undefined && isRecord(entry) && typeof entry.icon === 'string'
        ? entry.icon
        : undefined
    }
    for (const row of Array.isArray(section.sequence) ? section.sequence : []) {
      if (!isRecord(row) || typeof row.id !== 'string') continue
      if (row.type === 'group') {
        const members = (Array.isArray(row.members) ? row.members : []).filter((id) => typeof id === 'string')
        if (members.length === 0) continue
        /** @type {Record<string, unknown>} */
        const group = { type: 'group', id: `g_${row.id.replace(/^group:/, '')}`, members }
        if (typeof row.label === 'string' && row.label.length > 0) group.label = row.label
        if (typeof row.icon === 'string' && isBuiltinIcon(row.icon)) group.icon = row.icon
        else if (typeof row.icon === 'string') warnings.push(`group icon "${row.icon}" has no equivalent, dropped`)
        sequence.push(group)
        for (const member of members) seen.add(member)
        continue
      }
      if (seen.has(row.id)) continue
      seen.add(row.id)
      sequence.push({ type: 'panel', id: row.id })
    }

    /** @type {Record<string, Record<string, unknown>>} */
    const panels = {}
    for (const [id, value] of Object.entries(legacyIcons)) {
      if (!isRecord(value)) continue
      /** @type {Record<string, unknown>} */
      const override = {}
      if (typeof value.label === 'string' && value.label.trim().length > 0) override.label = value.label.trim()
      if (value.hidden === true) override.hidden = true
      if (typeof value.icon === 'string') {
        if (isBuiltinIcon(value.icon)) override.icon = value.icon
        else warnings.push(`icon "${value.icon}" for "${id}" has no equivalent, dropped`)
      }
      if (Object.keys(override).length > 0) panels[id] = override
    }

    const normalized = normalizeConfig({ sequence, panels })
    if (!normalized.ok) warnings.push(...normalized.errors.slice(0, 5))
    return { found: true, config: normalized.config, warnings }
  }
}