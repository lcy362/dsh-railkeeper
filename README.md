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

## Install

```bash
dsh plugin --profile desktop add dsh-railkeeper
```

Or install a local checkout from **Settings → Plugins → Add plugin**.

Then open **Settings → Panel list**.

## Important: do not run two rail managers at once

Railkeeper rewrites the `sidebar.panellist` registrations that the sidebar shell reads. Any other plugin doing the same will fight it, and the two will overwrite each other in a loop.

The transition that catches people: **if you just disabled `dsh-panellist` and did not reload the page, its client half is still loaded** and still rewriting the same entries. Railkeeper detects this, stops rewriting order and names, and shows a banner asking you to reload the page (or restart the app). Hide markers are still applied, so nothing is lost.

Reload the page once and Railkeeper owns the rail on its own.

## Compatibility

- DSH `>=0.2.0-rc.2 <0.3.0-0`, verified on `0.2.2-rc.3`.
- Node `^22.19.0 || >=24.0.0` (only for building and testing).

Railkeeper deliberately depends on **no** Harness client package besides React. Icons, controls, styles, and the settings page are its own, so a DSH release that renames or removes an internal export cannot blank it out.

The one internal seam it does use: rewriting a slot registration's `options` does not notify subscribers, so Railkeeper registers and immediately disposes a throwaway entry to nudge the sidebar into re-reading the ledger. If that ever stops working, the rail simply stops following the configuration — panels keep loading, nothing breaks. The plugin reports what it measured to `GET /railkeeper/api/client-status` so this is diagnosable rather than mysterious.

## HTTP surface

All endpoints live under `/railkeeper/api`, are reachable only from loopback, and are also fenced by `Host`; write requests additionally require same-origin (or no `Origin` at all, which is the Desktop IPC bridge).

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
node --test "test/*.test.mjs"   # 51 tests: config, plan, host store, routes, migration
```

`src/client/*` is plain ES modules. The build inlines them into the single browser bundle DSH expects (`window.__ModuleLoader__.load({ id, factory })`), because runtime `require()` only resolves platform seeds.

After changing `src/client/*`, rebuilding is picked up by the client HMR without restarting the app; changing `src/host/*` needs an app restart. Bump `CLIENT_VERSION` in `src/client/index.js` when you change client code — it is reported to `/client-status` so you can confirm which generation is live.

## Verification status

`test/` covers the configuration model, the render plan, the flyout placement math, the host store, the loopback routes, and the `dsh-panellist` migration.

The DOM paths are **not** unit-tested: rewriting rail rows, hiding, and the group flyout all need a real browser. They are verified in a running app by reading the real DOM after each rebuild — row count, visible row count, per-row labels, hidden-marker count, and group-row marker count are reported to `/client-status` and compared against the plan. Every stylesheet selector railkeeper injects is scoped to the rail `nav` (`[data-rk-rail]`) or to its own `.rk-*` classes, so it cannot restyle another page.

## License

MIT
