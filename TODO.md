# API Tester — TODO

## ✅ Done
- GitHub OAuth (Device Flow + PAT)
- GitHub sync — load/save/rename/delete collections and requests
- Collections sidebar with context menus (rename, delete, add request)
- Tab bar, basic request builder
- Environment variables (interpolation engine)

---

## Milestone 1 — Core UI (next)

### Request Builder completeness
- [ ] Query params tab (key/value table, toggleable rows)
- [ ] Headers tab (key/value table, toggleable rows)
- [ ] Body tab — raw (JSON/text), form-data, x-www-form-urlencoded
- [ ] Auth tab — Bearer token, Basic, API Key
- [ ] Wire all fields into the HTTP engine before sending

### Response Viewer
- [ ] Status code + time + size indicator bar
- [ ] Syntax-highlighted body (JSON, XML, HTML, plain text)
- [ ] Response headers table
- [ ] Pretty / Raw / Preview toggle

### Environment Manager UI
- [ ] Environment list panel (create, rename, delete)
- [ ] Key-value editor per environment
- [ ] Active environment selector in topbar
- [ ] Variable highlighting in URL bar ({{var}} shown distinctly)

---

## Milestone 2 — Quality of Life

- [ ] Search/filter requests across collections in sidebar
- [ ] Drag-and-drop to reorder / move requests between collections
- [ ] Keyboard shortcuts — Cmd+Enter send, Cmd+T new tab, Cmd+W close tab
- [ ] Request history panel (last 100, replay)

---

## Milestone 3 — Power Features

- [ ] Collection runner — run all requests sequentially, show pass/fail
- [ ] Import — Postman v2.1 and Bruno `.bru` files
- [ ] Code generation — copy as curl, fetch, axios
- [ ] Resizable split pane (replace fixed 50/50)

---

## Milestone 4 — Desktop

- [ ] Native HTTP via Electron IPC (no proxy needed)
- [ ] Auto-update via electron-updater
