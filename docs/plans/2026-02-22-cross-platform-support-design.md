# Cross-Platform Windows + Unix Support

**Date**: 2026-02-22
**Status**: Approved

## Problem

The project was originally developed on WSL/Linux. After migrating to native Windows development, several scripts and npm commands fail on PowerShell/cmd.exe due to Unix-specific syntax. The project should work seamlessly on both platforms.

Additionally, Claude Code verification workflows should prefer Chrome (via "Claude in Chrome" MCP) over Preview tools, since Preview cannot authenticate with Google OAuth.

## Changes

### 1. Fix `check` script with `cross-env`

The `check` script uses `VAR=value cmd` syntax which only works on Unix shells.

- Install `cross-env` as a devDependency
- Wrap env var assignments in `check` script with `cross-env`

### 2. Fix `clean` script with Node.js

The `clean` script uses `rm -rf .next` which fails on native Windows.

- Replace with `node -e "require('fs').rmSync('.next',{recursive:true,force:true})"`

### 3. Add `.gitattributes`

No `.gitattributes` exists. Line endings may drift between platforms.

- Add `.gitattributes` enforcing LF for source files
- Prevents line-ending churn in diffs when switching between Windows and Unix

### 4. Chrome-first verification in CLAUDE.md

Preview tools can't authenticate, making them useless for most app pages.

- Add a prominent section to CLAUDE.md requiring Chrome/browser extension for verification of authenticated pages
- Preview tools only for unauthenticated pages (landing, login)

### 5. Windows development docs in CLAUDE.md

- Add a short section noting the project supports native Windows (PowerShell/cmd)
- Document that `cross-env` handles env var differences

## Already Fixed (this session)

These were fixed earlier in this session and are included for completeness:

- `scripts/dev-server.js` — `spawn('npx', ...)` replaced with `spawn(process.execPath, [next binary])` (no shell needed)
- `scripts/setup-worktree.js` — `which` → platform-aware, `mktemp -d` → `mkdtempSync`, `rm -rf` → `rmSync`, path joins via `join()`
- `scripts/worktree-remove.js` — `which` → platform-aware, `rm -rf` → `rmSync`
- MongoDB data migrated from WSL to Windows instance
