# Build Manifest Errors

## Overview

You may occasionally see errors like:
```
[Error: ENOENT: no such file or directory, open '/home/zwrose/weekly-eats/.next/server/pages/_app/build-manifest.json']
```

## What Causes These Errors?

These errors occur when:
1. **File changes during dev server**: Next.js is trying to access build artifacts while files are being modified
2. **Stale build cache**: The `.next` directory is in an inconsistent state
3. **Race conditions**: Next.js's file watcher and build process are out of sync

## Are They Harmful?

**No, these errors are harmless in development.** They're race conditions that Next.js handles gracefully. The dev server will automatically rebuild the missing files.

## How to Prevent Them

### Option 1: Clean Build (Recommended when errors persist)
```bash
npm run clean
npm run dev
```

Or use the convenience script:
```bash
npm run dev:clean
```

### Option 2: Let Next.js Handle It
These errors are automatically resolved by Next.js. The dev server will:
- Detect the missing file
- Rebuild it automatically
- Continue serving your app

### Option 3: Restart Dev Server
If errors persist, simply restart the dev server:
```bash
# Stop the server (Ctrl+C)
npm run dev
```

## When to Clean `.next`

Clean the `.next` directory when:
- Errors persist after restarting the dev server
- You've made significant structural changes (e.g., moved files)
- You're switching between branches with different Next.js versions
- You're experiencing persistent build issues

## Configuration

The `next.config.ts` includes `onDemandEntries` configuration to help reduce these race conditions by managing page buffer lifecycle more efficiently.

