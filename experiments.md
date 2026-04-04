# Top Menu Bar "FS" Entry — Experiment Log

## Goal
Show sidebar view with custom icon in activity bar WITHOUT creating a top menu bar entry in Arduino IDE.

## Root Cause Analysis
- Arduino IDE (Theia 1.57.0) removes `CommonMenus.VIEW` from `MAIN_MENU_BAR`
- When a VSIX declares `viewsContainers.activitybar`, Theia's `PluginViewRegistry.doRegisterViewContainer()` registers a menu action at `CommonMenus.VIEW_VIEWS` = `['menubar', '4_view', '2_views']`
- Since `'4_view'` was removed, `MenuModelRegistry.findSubMenu()` recreates it with `label = undefined`
- `undefined` label → `CompoundMenuNodeRole.Group` → contents get **flattened** into parent
- The "FS" toggle action bubbles up directly into `MAIN_MENU_BAR` as a standalone top-level item
- Menu registration is deferred via `onViewAdded()` — only fires when a view is registered in the container

## Experiments

### 1. viewsContainers.activitybar + views.littlefs (DEFAULT)
- **Config**: `viewsContainers.activitybar[{id:"littlefs", title:"FS"}]` + `views.littlefs[{id:"littlefs-actions"}]`
- **Result**: ✅ Sidebar works, custom icon. ❌ "FS" appears in top menu bar.

### 2. views.explorer (no viewsContainers)
- **Config**: `views.explorer[{id:"littlefs-actions"}]`, removed viewsContainers entirely
- **Result**: ❌ View COMPLETELY GONE from sidebar. Arduino IDE replaces standard explorer with SketchbookWidget.

### 3. Zero-width space title `\u200B`
- **Config**: `viewsContainers.activitybar[{title:"\u200B"}]`
- **Result**: ⚠️ Text invisible but padding/gap still visible in menu bar.

### 4. views.debug (no viewsContainers)
- **Config**: `views.debug[{id:"littlefs-actions"}]`, removed viewsContainers entirely
- **Result**: ❌ FS gone from menu BUT view also GONE. Debug container probably not initialized by default in Arduino IDE, or the wrapped DebugFrontendApplicationContribution blocks plugin views.

### 5. views.scm (no viewsContainers) — SKIPPED (same mechanism, will fail like debug)

### 6. views.test (no viewsContainers) — SKIPPED (same mechanism, will fail like debug)

### 7. Empty container + views.scm (split icon from view)
- **Config**: `viewsContainers.activitybar[{id:"littlefs"}]` + `views.scm[{id:"littlefs-actions"}]`
- **Hypothesis**: Container has no views → `onViewAdded()` never fires → no menu entry. View goes to SCM.
- **Result**: ❌ BOTH icon and view GONE. Empty container is hidden by Theia. SCM container rejects plugin webview views (same issue as explorer/debug).

### 8. Single space title `" "`
- **Config**: `viewsContainers.activitybar[{title:" "}]` + `views.littlefs[...]`
- **Result**: ❌ Sidebar BROKEN + too much whitespace in menu bar. Space title breaks the container.

### 9. viewsContainers with `panel` location — SKIPPED (menu still created at VIEW_VIEWS regardless)

### 10. Pre-register toggle command from activate() — NOT VIABLE
- Theia's `CommandRegistry.registerCommand()` warns but returns `Disposable.NULL` when command exists
- `registerMenuAction` still runs regardless of command registration failure
- VS Code extension API can't control `isVisible` for auto-generated menu actions

## Summary
**No VSIX-only approach can eliminate the top menu bar entry.** The root cause is hardcoded in Theia's `PluginViewRegistry.doRegisterViewContainer()` which always registers at `CommonMenus.VIEW_VIEWS`. When Arduino IDE removes VIEW from the menu bar, the auto-recreated path causes Group flattening and the action bubbles up as a top-level item.

### Failed approaches
- **Built-in containers** (explorer, debug, scm): Arduino IDE wraps all of them; plugin webview views are rejected
- **Empty container + view elsewhere**: Empty containers are hidden by Theia
- **Space/zero-width title**: Breaks the sidebar entirely
- **Deployed package.json hack** (delete viewsContainers at runtime): Sidebar dies because Theia needs viewsContainers at startup to create the container widget. Layout state alone doesn't preserve it.
- **Electron API access**: `require('electron')` NOT available from extension host
- **Pre-register toggle command**: Theia's CommandRegistry allows multiple handlers; doesn't prevent menu registration

### Diagnostic findings (from probing)
- Toggle command: `plugin.view-container.workbench.view.extension.littlefs.toggle`
- Electron 30.1.2 but not accessible from plugin host
- Deployed path: `~/.arduinoIDE/deployedPlugins/arduino-littlefs-upload-X.X.X/extension/package.json`
- App root: `C:\Users\Asus\AppData\Local\Programs\Arduino IDE\resources\app`
- 944 total commands available, none for menu manipulation

### Viable Options
1. **Accept "FS" in menu bar** — fully functional, cosmetic-only issue
2. **Modify Arduino IDE source** — add `.filter(item => Array.isArray(item.submenu) || item.type === 'separator')` in `electron-main-menu-factory.ts` `createElectronMenuBar()` to strip non-submenu items from top-level menu
3. ✅ **Frontend bundle patch (NUKE)** — In `activate()`, patch `bundle.js` in the Arduino IDE installation to inject the same filter. Surgical, reversible (IDE update overwrites). Requires two restarts on first install (first applies patch, second loads it). Self-maintaining: re-patches after IDE updates.
   - Target string: `const i=this.escapeAmpersand(t);return this.menu=i,i`
   - Patched string: `const i=this.escapeAmpersand(t.filter(e=>Array.isArray(e.submenu)||"separator"===e.type));return this.menu=i,i`
   - Location: `{appRoot}/lib/frontend/bundle.js` @ ~offset 6728041

### Additional experiments (Round 2)

### 11. views.explorer + focus command
- **Config**: `views.explorer[{id:"littlefs-actions"}]`, no viewsContainers. In `activate()`, call `littlefs-actions.focus`.
- **Result**: ⚠️ View shows inside Explorer panel. No "FS" menu entry. BUT: nested in Explorer, not its own sidebar tab.

### 12. Deployed package.json title modification (U+2800 Braille Blank)
- **Config**: Standard `viewsContainers.activitybar`, in `activate()` modify deployed `package.json` title from `"FS"` to `"\u2800"`.
- **Result**: ⚠️ Same as zero-width space — invisible button/padding gap remains. Electron allocates space regardless of label text.

### 13. contributes.menus / submenus to restore View menu
- **Research**: Can plugins contribute to the main menu bar?
- **Result**: ❌ NOT POSSIBLE. Only context menus and UI menus supported. No `menubar/*` contribution points.

### 14. Theia internal API access from plugin host
- **Diagnostic**: `require('@theia/plugin-ext')`, globals, require.cache.
- **Result**: ❌ SEALED. Webpack-bundled `plugin-host.js`. No Theia modules, no RPC access, no MenuModelRegistry.