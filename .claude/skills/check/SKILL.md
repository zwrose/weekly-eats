---
name: check
description: Run the full lint + test + build validation pipeline
disable-model-invocation: true
---

Run the full project validation pipeline before pushing:

```bash
npm run check
```

This runs in order:
1. **ESLint** with zero warnings tolerance
2. **Vitest** with coverage reporting
3. **Next.js production build**

If any step fails, stop and report the failure clearly. Suggest specific fixes for any lint errors, test failures, or build errors found.
