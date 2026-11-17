# Railkeeper

English | [简体中文](README.zh-CN.md)

Take over the left rail of [DeepSeek Harness](https://www.deepseek.com/en/harness/): **reorder, rename, re-icon, hide, and group** the panel buttons. Changes apply instantly and survive restarts.

Railkeeper is a drop-in replacement for the unmaintained `dsh-panellist`, written against the current DSH client API (`0.2.2`), with a **one-click import of an existing `dsh-panellist` configuration**.

## What it does

| Capability | Notes |
|---|---|
| Reorder | Drag the handle, or use the ↑ / ↓ buttons (keyboard reachable). |
| Rename | Type a new name; clearing it restores the plugin's own label. |
| Re-icon | 24 built-in line glyphs; "Original icon" restores the plugin's own. |
| Hide | A hidden panel keeps working and stays selectable — its rail row is just not drawn. |
| Group | Merge two or more panels into one rail row. Clicking that row opens a member menu beside it instead of navigating away. |
| Import / export | The whole configuration as JSON, for backup or moving between machines. |
| Migrate | Reads `$DSH_HOME/panellist.json` and converts it to this plugin's shape. |
| Storage | One JSON document at `$DSH_HOME/railkeeper.json`, split per profile, mode `0600`. |

Configuration is the only state Railkeeper owns. It never rewrites the profile's `cordis.patch.yml`, and a broken config file is copied aside (`.corrupt-<timestamp>`) instead of being discarded.

Edits are written automatically about half a second after you stop. The status line under the title says whether the current state is saved; a failed write keeps your changes on screen and offers a Retry button.

The settings page ends with a link to the [GitHub repository](https://github.com/lcy362/dsh-railkeeper) — if it is useful to you, a star makes the author's day. "Maybe later" dismisses it for good.

## Install

```bash
dsh plugin --profile desktop add dsh-railkeeper
```

Or install a local checkout from **Settings → Plugins → Add plugin**.

Then open **Settings → Panel list**.

## Coexisting with other rail plugins

Railkeeper **never rewrites another plugin's registration entries**. For a panel it needs to change, it registers a *shadow entry* of its own — same id, one priority step below every other registrant in that cell — and the host picks the winner by priority. As a result:

- Presentation-only plugins keep working: a panel you have not touched is not shadowed at all, so the market's update badge still shows.
- Another plugin that *also* manages the rail (most often a just-disabled `dsh-panellist` whose client half is still loaded) no longer produces a write-trading loop: each side owns its own entries and the pair converges in one pass.
- Uninstalling railkeeper removes only its own entries; everyone else's registrations are left exactly as they were.

If railkeeper finds its shadow entry in some cell outranked by a lower priority, the settings page says so and suggests reloading (Cmd+R) or restarting. It does **not** try to win it back — trading writes is exactly what made earlier versions hang.

One known trade-off: the plugin market only attaches its update badge when a cell has exactly one registration, so it will not attach it to a cell railkeeper shadows. That is the market's own rule and railkeeper cannot bypass it; the badge returns once the shadow is gone.

## Compatibility

- DSH `>=0.2.0-rc.2 <0.3.0-0`, verified on `0.2.2-rc.3`.
- Node `^22.19.0 || >=24.0.0` (only for building and testing).

Railkeeper deliberately depends on **no** Harness client package besides React. Icons, controls, styles, and the settings page are its own, so a DSH release that renames or removes an internal export cannot blank it out.

The one internal seam it does use: rewriting a slot registration's `options` does not notify subscribers, so Railkeeper registers and immediately disposes a throwaway entry to nudge the sidebar into re-reading the ledger. If that ever stops working, the rail simply stops following the configuration — panels keep loading, nothing breaks. The plugin reports what it measured to `GET /railkeeper/api/client-status` so this is diagnosable rather than mysterious.

## HTTP surface

All endpoints live under `/railkeeper/api` and pass three admission layers, in this order:

1. **DSH's own trust fence** — every request asks `ctx.connection.requestRejection(req)` first. Routes mounted with `webServer.register` do not go through DSH's Host/Origin admission on their own, so the plugin has to ask. This is the authoritative check.
2. **A local fallback** — the socket peer must be loopback *and* the `Host` header must name a loopback authority. Comparing only `Origin` against `Host` is bypassable by DNS rebinding, where both become the attacker's domain; requiring a loopback `Host` is what actually stops it. `sec-fetch-site: cross-site` is refused.
3. **JSON for writes** — `POST`/`PUT` must declare `application/json`. A cross-site form cannot send that without a preflight, so this closes the simple-request CSRF class. The browser half always sends it.

A `403` from the fence is rejected outright. A `401` (trustworthy but unauthenticated) is *not*: the desktop page is loaded over `dsh-app://`, not `http://127.0.0.1`, so its `fetch` may not carry the auth cookie — refusing that would blank the UI. It falls through to layer 2, which still blocks the cross-site shapes.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Storage and profile status. |
| `GET` | `/config` | The current profile's configuration. |
| `PUT` | `/config` | Save `{ config }`. Rejects invalid input with `400` and a reason. |
| `POST` | `/config/reset` | Restore an empty configuration. |
| `GET` | `/legacy` | Convert an existing `dsh-panellist` configuration. |
| `GET`/`POST` | `/client-status` | Recent diagnostics reported by the browser half (in memory, last 50). |

## Configuration shape

```jsonc
{
  "schemaVersion": 1,
  "profiles": {
    "desktop": {
      "sequence": [
        { "type": "panel", "id": "plugins" },
        { "type": "group", "id": "g_1", "label": "Stats", "icon": "chart",
          "members": ["dsh-context", "personal-kit-usage"] }
      ],
      "panels": {
        "schedules": { "hidden": true },
        "personal-kit-models": { "label": "Models", "icon": "bolt" }
      }
    }
  }
}
```

`sequence` describes order and grouping only. `panels` holds per-panel overrides. Rows for panels that are not currently registered are **kept**, so uninstalling a plugin and reinstalling it puts its row back where it was; the settings page lists them under "Configured but not installed".

## Development

```bash
node scripts/build-client.mjs   # build lib/client.js from src/client/
node --test "test/*.test.mjs"   # 85 tests: config, plan, shadow diffing, store, host, routes, migration, self-test
```

`src/client/*` is plain ES modules. The build inlines them into the single browser bundle DSH expects (`window.__ModuleLoader__.load({ id, factory })`), because runtime `require()` only resolves platform seeds.

After changing `src/client/*`, rebuilding is picked up by the client HMR without restarting the app; changing `src/host/*` needs an app restart. Bump `CLIENT_VERSION` in `src/client/index.js` when you change client code — it is reported to `/client-status` so you can confirm which generation is live.

## Self-test (off by default)

The self-test covers the two paths that fail silently: `selectProbe` selects a panel through `layout.selectPanel` and reads `activePanelId` back, and `clickProbe` dispatches a real `MouseEvent` at the first flyout item.

**It does not run automatically, because verifying the path has a side effect.** Proving that "clicking switches the panel" requires actually switching once and switching back, and `layout.selectPanel()` aborts the current navigation and notifies subscribers synchronously — so the intermediate frame is committed and visible, and the rail row (plus the group row that owns it) flashes as selected.

Trigger it when you need it: **Settings → Panel list → Run self-test** (it asks for confirmation), or set `localStorage['dsh-railkeeper.probe'] = '1'` and reload. When it has not run, both probes read `{ skipped: 'probe-disabled' }` in `GET /railkeeper/api/client-status`, which stays distinguishable from a failed run.

## Verification status

`test/` covers the configuration model, the render plan, shadow-entry diffing against a SlotCore-equivalent registry, the config store's write path, the flyout placement math, the host store, the loopback routes, the `dsh-panellist` migration, and the self-test gating.

The DOM paths are **not** unit-tested: rewriting rail rows, hiding, and the group flyout all need a real browser. They are verified in a running app by reading the real DOM after each rebuild — row count, visible row count, per-row labels, hidden-marker count, and group-row marker count are reported to `/client-status` and compared against the plan. Every stylesheet selector railkeeper injects is scoped to the rail `nav` (`[data-rk-rail]`) or to its own `.rk-*` classes, so it cannot restyle another page.

## License

MIT
