---
name: new-component
description: Scaffold a new React component with test file following project conventions
---

Scaffold a new component at the specified path under `src/components/`. Follow these project conventions exactly:

## Arguments

`/new-component <ComponentName>` — e.g., `/new-component MyWidget`

Optional: specify a subdirectory — `/new-component shopping-list/CartSummary`

## Component Template

```tsx
"use client";

import { Box, Typography } from '@mui/material';

interface <ComponentName>Props {
  // Define props here
}

export default function <ComponentName>({}: <ComponentName>Props) {
  return (
    <Box>
      <Typography>TODO: Implement <ComponentName></Typography>
    </Box>
  );
}
```

## Test Template

Place the test in a `__tests__/` folder next to the component:

- Component at `src/components/MyWidget.tsx` → test at `src/components/__tests__/MyWidget.test.tsx`
- Component at `src/components/shopping-list/CartSummary.tsx` → test at `src/components/shopping-list/__tests__/CartSummary.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import <ComponentName> from '../<ComponentName>';

describe('<ComponentName>', () => {
  afterEach(() => cleanup());

  it('renders without crashing', () => {
    render(<<ComponentName> />);
    // Update this assertion for actual content
    expect(screen.getByText(/TODO/i)).toBeInTheDocument();
  });
});
```

## Conventions

- **Directive**: Always add `"use client"` for interactive components
- **Styling**: Use MUI components and `sx` prop (no CSS files)
- **Exports**: Use `export default function` (matches existing component pattern)
- **Props**: Define an interface `<ComponentName>Props` even if empty initially
- **Naming**: PascalCase for file and component name
- **Memoization**: Add `React.memo()` wrapper if the component is a list item or receives complex props

## After Scaffolding

1. Implement the component logic
2. Update the test to cover real behavior
3. Run the test: `npx vitest run src/components/__tests__/<ComponentName>.test.tsx`
