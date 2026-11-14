/**
 * dsh-railkeeper —— 浏览器侧配置状态。
 *
 * 单一数据源：`config`。所有编辑先本地生效（乐观更新），再防抖写回宿主；
 * 写失败保留 dirty 状态并给出重试入口，不阻塞界面。
 */
import { defaultConfig, normalizeConfig } from '../shared/config.js'

/**
 * @param {{ load: Function, save: Function, reset: Function }} api
 * @param {{ t: Function }} i18n
 */
export function createConfigStore(api, i18n) {
  /** @type {{
   *   status: 'loading' | 'ready' | 'error',
   *   config: ReturnType<typeof defaultConfig>,
   *   profileId: string,
   *   health: Record<string, unknown> | null,
   *   error: string | null,
   *   saving: boolean,
   *   dirty: boolean,
   *   savedAt: number,
   *   revision: number,
   * }} */
  let state = {
    status: 'loading',
    config: defaultConfig(),
    profileId: '',
    health: null,
    error: null,
    saving: false,
    dirty: false,
    savedAt: 0,
    revision: 0,
  }
  const listeners = new Set()
  let saveTimer
  let inFlight = false
  let disposed = false

  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        // a view must not break the store
      }
    }
  }

  /** @param {Partial<typeof state>} patch */
  function set(patch) {
    state = { ...state, ...patch, revision: state.revision + 1 }
    notify()
  }

  function scheduleSave(delay = 450) {
    if (disposed) return
    if (saveTimer !== undefined) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void saveNow()
    }, delay)
  }

  async function saveNow() {
    if (disposed || inFlight || !state.dirty) return
    inFlight = true
    const revision = state.revision
    set({ saving: true })
    try {
      const result = await api.save(state.config)
      if (disposed) return
      const cleaned = normalizeConfig(result?.config)
      const dirty = state.revision !== revision
      set({
        status: 'ready',
        config: cleaned.ok ? cleaned.config : state.config,
        profileId: typeof result?.profileId === 'string' ? result.profileId : state.profileId,
        health: result?.health ?? state.health,
        saving: false,
        dirty,
        error: null,
        savedAt: Date.now(),
      })
      if (dirty) scheduleSave(120)
    } catch (error) {
      if (disposed) return
      set({
        saving: false,
        dirty: true,
        error: i18n.t('status.error', { message: error instanceof Error ? error.message : String(error) }),
      })
    } finally {
      inFlight = false
    }
  }

  return {
    getSnapshot() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async load() {
      set({ status: 'loading', error: null })
      try {
        const result = await api.load()
        const normalized = normalizeConfig(result?.config)
        set({
          status: 'ready',
          config: normalized.ok ? normalized.config : defaultConfig(),
          profileId: typeof result?.profileId === 'string' ? result.profileId : '',
          health: result?.health ?? null,
          error: normalized.ok ? null : i18n.t('status.error', { message: normalized.errors[0] ?? 'invalid config' }),
          dirty: false,
        })
      } catch (error) {
        set({
          status: 'error',
          error: i18n.t('error.load', { message: error instanceof Error ? error.message : String(error) }),
        })
      }
    },

    /**
     * 从宿主重新读取配置。
     *
     * 用于插件外部改动：手工编辑 railkeeper.json、另一个会话改了配置、
     * 或者窗口从后台回到前台。`dirty` 为真时不覆盖本地未保存的改动，
     * 除非显式 force。
     *
     * @param {{ force?: boolean }} [options]
     * @returns {Promise<boolean>} 是否真的重读了
     */
    async reload(options = {}) {
      if (state.dirty && options.force !== true) return false
      try {
        const result = await api.load()
        const normalized = normalizeConfig(result?.config)
        if (!normalized.ok) return false
        const revision = state.revision
        set({
          status: 'ready',
          config: normalized.config,
          profileId: typeof result?.profileId === 'string' ? result.profileId : state.profileId,
          health: result?.health ?? state.health,
          error: null,
          dirty: false,
        })
        return state.revision !== revision
      } catch {
        // 外部重读失败不改状态：界面上原来的配置仍然有效。
        return false
      }
    },

    /**
     * 以 mutator 的形式更新配置。返回是否接受。
     * @param {(config: ReturnType<typeof defaultConfig>) => ReturnType<typeof defaultConfig>} mutator
     */
    update(mutator) {
      let draft
      try {
        draft = mutator(state.config)
      } catch (error) {
        set({ error: error instanceof Error ? error.message : String(error) })
        return false
      }
      const normalized = normalizeConfig(draft)
      if (!normalized.ok) {
        set({ error: normalized.errors[0] ?? 'invalid config' })
        return false
      }
      set({
        status: state.status === 'loading' ? 'ready' : state.status,
        config: normalized.config,
        dirty: true,
        error: null,
      })
      scheduleSave()
      return true
    },

    /** 立即重试未成功的保存。 */
    retry() {
      if (state.dirty) {
        set({ error: null })
        void saveNow()
      } else {
        void this.load()
      }
    },

    async reset() {
      set({ saving: true })
      try {
        const result = await api.reset()
        const normalized = normalizeConfig(result?.config)
        set({
          status: 'ready',
          config: normalized.ok ? normalized.config : defaultConfig(),
          profileId: typeof result?.profileId === 'string' ? result.profileId : state.profileId,
          health: result?.health ?? state.health,
          saving: false,
          dirty: false,
          error: null,
          savedAt: Date.now(),
        })
      } catch (error) {
        set({
          saving: false,
          error: i18n.t('error.save', { message: error instanceof Error ? error.message : String(error) }),
        })
      }
    },

    /** @param {string} text */
    importJson(text) {
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.profiles !== undefined) {
        parsed = parsed.profiles?.[state.profileId] ?? defaultConfig()
      }
      const normalized = normalizeConfig(parsed)
      if (!normalized.ok) {
        return { ok: false, message: normalized.errors[0] ?? 'invalid config' }
      }
      set({ status: 'ready', config: normalized.config, dirty: true, error: null })
      scheduleSave(0)
      return { ok: true }
    },

    exportJson() {
      return JSON.stringify(state.config, null, 2)
    },

    dispose() {
      disposed = true
      if (saveTimer !== undefined) clearTimeout(saveTimer)
      listeners.clear()
    },
  }
}