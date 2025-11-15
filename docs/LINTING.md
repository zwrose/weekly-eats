# Linting Setup Guide

This project uses ESLint with Next.js configuration for code quality and consistency.

## Quick Start

### Run Linter

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors (where possible)
npm run lint -- --fix
```

## Editor Setup

### VS Code (Recommended)

1. **Install Extensions**:
   - Open VS Code
   - Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
   - Install the recommended extensions (VS Code will prompt you, or install manually):
     - **ESLint** (`dbaeumer.vscode-eslint`)
     - **Prettier** (`esbenp.prettier-vscode`) - Optional but recommended
     - **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`) - For Tailwind support

2. **Workspace Settings**:
   - The `.vscode/settings.json` file is already configured
   - ESLint will automatically run and show errors in your editor
   - Errors will be auto-fixed on save (where possible)

3. **Verify Setup**:
   - Open any `.ts` or `.tsx` file
   - You should see red squiggles for linting errors
   - Hover over errors to see the issue
   - Save the file to auto-fix (if fixable)

### Other Editors

#### Neovim/Vim

Install [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig) and configure ESLint:

```lua
-- In your Neovim config
require('lspconfig').eslint.setup({
  on_attach = function(client, bufnr)
    -- Auto-fix on save
    vim.api.nvim_create_autocmd("BufWritePre", {
      buffer = bufnr,
      command = "EslintFixAll",
    })
  end,
})
```

#### Emacs

Use [flycheck](https://www.flycheck.org/) or [lsp-mode](https://emacs-lsp.github.io/lsp-mode/):

```elisp
(use-package flycheck
  :config
  (add-hook 'typescript-mode-hook 'flycheck-mode)
  (add-hook 'typescript-tsx-mode-hook 'flycheck-mode))
```

## Linting Rules

The project uses:
- **Next.js ESLint config** (`next/core-web-vitals`, `next/typescript`)
- **TypeScript strict mode** (with exceptions for test files)

### Test Files

Test files (`**/__tests__/**/*.{ts,tsx}`, `**/*.{test,spec}.{ts,tsx}`) have relaxed rules:
- `@typescript-eslint/no-explicit-any`: off
- `@typescript-eslint/no-unused-vars`: off
- Vitest globals are defined

## Common Issues

### "ESLint not working"

1. **Check ESLint is installed**:
   ```bash
   npm list eslint
   ```

2. **Restart ESLint server in VS Code**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
   - Type "ESLint: Restart ESLint Server"
   - Press Enter

3. **Check ESLint output**:
   - In VS Code, go to View → Output
   - Select "ESLint" from the dropdown
   - Look for error messages

### "Auto-fix not working"

1. **Check settings**:
   - Verify `editor.codeActionsOnSave` includes `source.fixAll.eslint`
   - Check `.vscode/settings.json` exists

2. **Manual fix**:
   ```bash
   npm run lint -- --fix
   ```

### "Too many errors"

If you have many linting errors and want to fix them gradually:

1. **Fix specific files**:
   ```bash
   npm run lint -- --file src/path/to/file.tsx --fix
   ```

2. **Disable rules temporarily** (not recommended):
   ```typescript
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const data: any = {};
   ```

## CI Integration

The project runs linting in CI (see `.github/workflows/ci.yml`). All linting errors must be fixed before merging.

## Best Practices

1. **Fix linting errors before committing**
2. **Use auto-fix on save** (configured in VS Code)
3. **Don't disable rules** unless absolutely necessary
4. **Run `npm run lint` before pushing** to catch issues early

## Configuration Files

- `eslint.config.mjs` - Main ESLint configuration
- `.vscode/settings.json` - VS Code workspace settings
- `.vscode/extensions.json` - Recommended VS Code extensions

