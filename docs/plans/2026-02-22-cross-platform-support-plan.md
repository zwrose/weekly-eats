# Cross-Platform Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the project work seamlessly on Windows (PowerShell/cmd) and Unix, and enforce Chrome-first verification for authenticated pages.

**Architecture:** Configuration-only changes — npm scripts, a new `.gitattributes`, and CLAUDE.md updates. No application code changes.

**Tech Stack:** cross-env (npm package), Node.js built-in fs module

---

### Task 1: Install `cross-env` and fix `check` script

**Files:**
- Modify: `package.json:19` (check script)

**Step 1: Install cross-env**

Run: `npm install --save-dev cross-env`
Expected: Package added to devDependencies, lockfile updated

**Step 2: Update the `check` script in package.json**

Change line 19 from:
```json
"check": "npm run lint -- --max-warnings=0 && MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npm run test:coverage && MONGODB_URI='mongodb://localhost:27017/fake' SKIP_DB_SETUP=true npm run build",
```

To:
```json
"check": "npm run lint -- --max-warnings=0 && cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npm run test:coverage && cross-env MONGODB_URI=mongodb://localhost:27017/fake SKIP_DB_SETUP=true npm run build",
```

Note: Remove the single quotes around the MongoDB URI — `cross-env` doesn't need them and they cause issues on Windows.

**Step 3: Verify check script works**

Run: `npm run check`
Expected: Lint passes, tests pass (705 tests), build succeeds

**Step 4: Commit**

```
git add package.json package-lock.json
git commit -m "fix: use cross-env for cross-platform npm scripts"
```

---

### Task 2: Fix `clean` script

**Files:**
- Modify: `package.json:7` (clean script)

**Step 1: Update the `clean` script**

Change line 7 from:
```json
"clean": "rm -rf .next",
```

To:
```json
"clean": "node -e \"require('fs').rmSync('.next',{recursive:true,force:true})\"",
```

**Step 2: Verify clean works**

Run: `npm run clean`
Expected: No error. `.next` directory removed (or no-op if it doesn't exist).

**Step 3: Also update the Gotchas in CLAUDE.md**

Lines 141-142 reference `rm -rf .next`. Update to `npm run clean` instead:

Change:
```
- **Build cache**: If `npm run check` fails with MODULE_NOT_FOUND, clear `.next` directory: `rm -rf .next`
- **Dev server after build**: Turbopack dev server crashes with `Cannot find module 'chunks/ssr/[turbopack]_runtime.js'` after `npm run check` or `npm run build`. Fix: `rm -rf .next` then restart dev server.
```

To:
```
- **Build cache**: If `npm run check` fails with MODULE_NOT_FOUND, clear `.next` directory: `npm run clean`
- **Dev server after build**: Turbopack dev server crashes with `Cannot find module 'chunks/ssr/[turbopack]_runtime.js'` after `npm run check` or `npm run build`. Fix: `npm run clean` then restart dev server.
```

**Step 4: Commit**

```
git add package.json CLAUDE.md
git commit -m "fix: make clean script cross-platform"
```

---

### Task 3: Add `.gitattributes`

**Files:**
- Create: `.gitattributes`

**Step 1: Create `.gitattributes`**

```
# Ensure consistent line endings across platforms
* text=auto

# Force LF for source files (prevents CRLF in repo)
*.js text eol=lf
*.cjs text eol=lf
*.ts text eol=lf
*.tsx text eol=lf
*.json text eol=lf
*.md text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
*.css text eol=lf
*.sh text eol=lf

# Binary files
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.woff binary
*.woff2 binary
```

**Step 2: Normalize existing files**

Run:
```bash
git add --renormalize .
```

This re-checks line endings on all tracked files against the new rules. There may be no changes if Git was already configured with `core.autocrlf=true`.

**Step 3: Commit**

```
git add .gitattributes
git commit -m "chore: add .gitattributes for consistent line endings"
```

---

### Task 4: Add Chrome-first verification and Windows docs to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Verification section after "Validation Workflow"**

Insert after the "Validation Workflow" section (after line 194), before "Do Not Edit":

```markdown
## Verification (UI Changes)

- **Always use Chrome / "Claude in Chrome" MCP tools** for verifying UI changes — this app requires Google OAuth login, so Preview tools cannot access authenticated pages.
- Preview tools (preview_*) may only be used for unauthenticated pages (landing page, sign-in screen).
- For authenticated pages: use `mcp__Claude_in_Chrome__*` tools (screenshot, read_page, find, computer, etc.) to verify changes in a browser where the user is already signed in.

## Windows Development

- The project supports **native Windows** (PowerShell, cmd.exe) in addition to Unix/macOS.
- All npm scripts use `cross-env` for environment variables — no Unix-only `VAR=x cmd` syntax.
- All Node.js scripts use cross-platform APIs (`path.join`, `fs.rmSync`, `os.tmpdir`) — no `rm -rf`, `mktemp`, or `which`.
- If adding new scripts: use Node.js built-in APIs for file operations, and `process.platform === 'win32'` for platform-specific command names.
```

**Step 2: Commit**

```
git add CLAUDE.md
git commit -m "docs: add Chrome-first verification and Windows dev sections"
```

---

### Task 5: Final validation

**Step 1: Run full check**

Run: `npm run check`
Expected: Lint passes, 705 tests pass, build succeeds.

**Step 2: Verify clean works**

Run: `npm run clean`
Expected: `.next` removed, no errors.
