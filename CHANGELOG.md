# Changelog

All notable changes to this project will be documented in this file.

Format: `## YYYY-MM-DD — Summary`

---

## 2026-08-07 — Git Credential Fix (Background Push)

### Problem
Mobile data sync showed "GitHub Pages 반영 대기 중" indefinitely. Commits accumulated locally but never reached GitHub Pages.

### Root Cause
Background Python processes (Task Scheduler) cannot access Windows Credential Manager (`wincredman`). Git push failed with:
```
fatal: Unable to persist credentials with the 'wincredman' credential store.
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

### Fix
1. Set local `credential.helper=store` (overrides system `manager`)
2. Created `%USERPROFILE%\.git-credentials` with GitHub PAT
3. Added `.git_sync.lock` to `.gitignore`
4. Manually pushed 5 accumulated commits

### Affected Files
- `auto_github_uploader.py` — No code changes (uses inherited git config)
- `server.py` — No code changes (uses inherited git config)
- `.gitignore` — Added `.git_sync.lock`
- `.git-credentials` — Created at `%USERPROFILE%`
- `ARCHITECTURE.md` — Created
- `.instructions.md` — Created
- `CHANGELOG.md` — Created

### Verification
- ✅ `auto_github_uploader.py` successfully pushed after fix
- ✅ `git push origin main` works from terminal
- ✅ `.git_sync.lock` properly cleaned up

---

## Template for Future Changes

```markdown
## YYYY-MM-DD — Brief Summary

### Problem / Motivation
What issue was addressed or what feature was added.

### Changes
- **File A**: What changed and why
- **File B**: What changed and why

### Affected Flows
- Which data flows / endpoints are affected

### Verification
- How to verify the change works
```
