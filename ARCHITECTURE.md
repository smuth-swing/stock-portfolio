# Architecture: 주식 포트폴리오 관리 시스템

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Mobile PWA (Expo)                     │
│              smuth-swing.github.io/stock-portfolio        │
└──────────────┬──────────────────────────┬────────────────┘
               │ fetch JSON               │ POST edits
               ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│      GitHub Pages        │   │   Flask Server (:5000)    │
│  (static JSON hosting)   │   │   server.py               │
└──────────────▲───────────┘   └────────┬─────────────────┘
               │ git push               │ read/write
┌──────────────┴───────────┐   ┌────────▼─────────────────┐
│   auto_github_uploader   │   │  OneDrive Excel File      │
│   (watches Excel → push) │   │  주식 체크 리스트_...xlsx │
└──────────────────────────┘   └───────────────────────────┘
               │                          ▲
               │ exports                  │ LS API
┌──────────────▼───────────┐   ┌─────────┴─────────────────┐
│   export_to_json.py      │   │   export_signals.py        │
│   export_signals.py      │   │   ls_api.py               │
└──────────────────────────┘   └───────────────────────────┘
               │
               ▼
┌──────────────────────────┐
│  StockPortfolioApp/      │
│  public/data/*.json      │
│  mobile/data/*.json      │
└──────────────────────────┘
```

## Data Flow Details

### 1. Read Flow (Web/Mobile → Display)
```
Browser/Mobile → Flask GET /api/read-excel
  → openpyxl loads Excel from OneDrive
  → pandas DataFrame → JSON
  → Return to client
```
Alternatively, GitHub Pages version reads static JSON files directly.

### 2. Write Flow (Mobile → Excel → GitHub)
```
Mobile App → POST /api/sync-receive (edits array)
  → group edits by file
  → for each file: openpyxl load → apply edits → save
  → trigger_export_and_push_sync():
      1. Run export_to_json.py → generate JSON
      2. xcopy StockPortfolioApp/public/data → mobile/data
      3. git add . && git commit && git push origin main
  → Return HTML page (auto-redirect back to mobile app)
```

### 3. Auto Upload Flow (Excel Change → GitHub)
```
auto_github_uploader.py (10-sec polling)
  → detect Excel file modification (mtime change)
  → wait 5 sec for file save completion
  → check .git_sync.lock (defer if server sync in progress)
  → run export_to_json.py
  → run export_signals.py (fetch LS API data)
  → xcopy data → mobile/data
  → git add . && git commit && git push origin main
  → git checkout gh-pages && merge && push (optional)
```

## Key Components

### server.py — Flask API Server
**Port**: 5000 (0.0.0.0 + LAN IP)
**Key functions**:
- `parse_strikethrough_text(value)` — Handle Excel rich text with strikethrough
- `trigger_export_and_push_sync()` — Synchronous export + git push (called by sync_receive)
- `sync_receive()` — Mobile sync endpoint, handles edits array
- `sync_portfolio_map(wb, stock_name, trade_amount)` — Update portfolio allocation
- `save_journal()` — Save trade journal entry
- `git_has_changes()` — Check if git has pending changes

**Excel sheets**:
- `매매일지` (Trade Journal) → `trade_journal.json`
- `포트폴리오 맵` (Portfolio Map) → `portfolio_map.json`
- `탐구생활` (Investigation) → `investigation.json`
- `실적` (Performance) → `performance.json`
- `배당금` (Dividends) — additional sheet

### auto_github_uploader.py — Background Uploader
**Polling interval**: 10 seconds
**Key functions**:
- `upload_to_github_with_json()` — Main upload cycle
- `run_no_window(cmd, ...)` — Run subprocess without console window (CREATE_NO_WINDOW)
- Lock coordination via `.git_sync.lock`

### export_to_json.py — Excel → JSON Converter
- Reads Excel from OneDrive
- Exports 4 sheets as JSON to `StockPortfolioApp/public/data/`
- Mirrors to `OneDrive/주식앱데이터/`
- Updates `meta.json` with server IP and timestamp

### export_signals.py — LS API Signal Fetcher
- Reads stock list from `portfolio_map.json` and `investigation.json`
- Calls LS API for moving averages and RSI
- Outputs to `moving_averages.json`
- Implements retry logic (3 attempts) and rate limiting

## Git Configuration

### Remote
- `origin`: `https://github.com/smuth-swing/stock-portfolio.git`
- Branches: `main` (primary), `gh-pages` (GitHub Pages deployment)

### Credential Setup (2026-08-07 fix)
```
Local:   credential.helper=store
System:  credential.helper=manager (overridden by local)
File:    %USERPROFILE%\.git-credentials (contains PAT)
```
Background processes (Task Scheduler) use `store` helper because
`manager` (wincredman) is inaccessible from non-interactive sessions.

### Sync Lock Mechanism
`.git_sync.lock` coordinates between:
- `server.py` sync-receive (synchronous push)
- `auto_github_uploader.py` (polling-based push)
- 5-minute timeout for stale lock detection

## Windows Infrastructure

### Task Scheduler Jobs
| Task | Script | Trigger |
|------|--------|---------|
| Stock Server | `run_server_hidden.vbs` | At login |
| Auto Uploader | `run_auto_uploader_hidden.vbs` | Every 10 min |
| Health Check | `run_health_check_hidden.vbs` | Every 5 min |

### Startup
- `setup_startup.ps1` configures auto-start
- `create_startup_shortcut.ps1` creates shortcuts in Startup folder
- Server starts hidden (no console window) via VBS launcher

## External Dependencies

### OneDrive
- Path: `C:\Users\zerod\OneDrive`
- Excel file synced by OneDrive desktop client
- `StockPortfolioApp/public/data/` served via GitHub Pages (not OneDrive)

### LS Securities API (ls_api.py)
- Provides stock prices, moving averages, RSI
- Config in `ls_api_config.json`
- OAuth token-based authentication

### GitHub Pages
- URL: `https://smuth-swing.github.io/stock-portfolio`
- `/mobile/` — PWA for phone
- `/stock-portfolio/mobile/` — Alternative path
- Deployed via `main` branch → `gh-pages` branch
