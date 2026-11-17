# Railkeeper

Take over the left rail of DeepSeek Harness: reorder, rename, re-icon, hide, and group the panel buttons. Changes apply instantly and survive restarts.

## Usage

Open **Settings → Panel list**. Every registered rail panel appears as a row.

- **Reorder** — drag the `⠿` handle, or use the ↑ / ↓ buttons.
- **Rename** — type into the row's name field. Clearing it restores the plugin's own label.
- **Re-icon** — click the leading icon button and pick one of the 24 built-in glyphs, or "Original icon".
- **Hide** — the `●` / `◌` toggle. A hidden panel keeps working and stays selectable; only its rail row is not drawn.
- **Group** — tick two or more panels and press "Group selected". The group takes one rail row; clicking that row opens a member menu beside it (Escape, an outside click, or scrolling closes it). Ungroup with `⇲`.
- **Import / export** — the whole configuration as JSON.
- **Migrate** — "Import from dsh-panellist" reads `$DSH_HOME/panellist.json` and converts it.

Changes save automatically, shortly after you stop editing. The status line under the title says whether the current state is saved.

## Limitations

- **One rail manager at a time.** Railkeeper rewrites the `sidebar.panellist` registrations the sidebar shell reads. Another plugin doing the same will overwrite it and vice versa. If a just-disabled plugin's code is still in the page (no reload since), Railkeeper stops rewriting order and names and shows a banner; reload the page to recover. Hide markers keep working during that time.
- **A hidden panel is still mounted.** Hiding is a CSS-level hide of the rail row, not an unload. The panel's own code keeps running.
- **A group row opens a menu.** The click is taken over in the capture phase so the shell does not navigate away. A `main` page is still registered for the group, because the shell's More menu routes through the same `selectPanel` call; reaching a group from there shows a plain member list styled like an official entry page.
- **Icons come from a fixed set of 24.** There is no SVG upload; an imported icon name with no equivalent is dropped with a warning rather than stored.
- **Configuration follows the profile, not the window.** Two windows on the same profile share one configuration.
- **The conflict detector needs three consecutive observations** before it pauses rewriting, so a single stray write does not trip it.

## Configuration

One JSON document at `$DSH_HOME/railkeeper.json`, split per profile:

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

- `sequence` — order and grouping only. `{type:'panel'}` is one standalone row; `{type:'group'}` is one row holding `members`.
- `panels` — per-panel overrides: `label`, `icon`, `hidden`.
- Rows for panels that are not currently registered are kept, so reinstalling a plugin restores its position. They are listed under "Configured but not installed".
- An invalid document is never written. On read, a corrupt file is copied to `railkeeper.json.corrupt-<timestamp>` and an empty configuration is served; the file is never deleted.

## Route access

`/railkeeper/api/*` is mounted with `webServer.register`, which DSH does **not** put behind its own Host/Origin admission. Railkeeper therefore asks `ctx.connection.requestRejection(req)` itself on every request, then falls back to requiring a loopback peer and a loopback `Host` (a plain `Origin`-versus-`Host` comparison is bypassable by DNS rebinding), then requires `application/json` on writes.

A `403` from the fence is honoured. A `401` falls through to the loopback check instead of being refused, because the desktop page is served from `dsh-app://` and its `fetch` may not carry the auth cookie; refusing it would blank the UI while blocking nothing extra — cross-site shapes still fail the loopback check.

## Self-test

Shortly after load, railkeeper runs an invisible self-test (the menu it opens is not painted and does not take focus) over the two paths that fail silently: selecting a panel through `layout.selectPanel`, and clicking a flyout item through a real `MouseEvent`. Results are `selectProbe` and `clickProbe` in `GET /railkeeper/api/client-status`.

## Troubleshooting

**The rail does not follow the configuration.** Read `GET /railkeeper/api/client-status` on the running server's port. Each `rebuild` record carries the plan (`planRows`), what was written (`appliedOrders`), what the registry holds now (`ledgerOrders`), and the measured DOM (`rows`, `visibleRows`, `rowLabels`, `hiddenMarkers`). `appliedOrders` differing from `ledgerOrders` means another writer is active.

**A banner says another rail manager is active.** Reload the page (Cmd+R) or restart the app. Most often this is a disabled `dsh-panellist` whose client half is still loaded in the current page.

**A group row or a flyout item does nothing.** `clickProbe.after` should name the clicked member, and `flyoutFallbacks` should be `0`; both are in `/railkeeper/api/client-status`.

**The settings page is empty.** The host half did not answer. Check that the plugin is enabled in **Settings → Plugins**, then press Retry.

## License

MIT
