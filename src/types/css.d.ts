// Ambient declaration for global CSS side-effect imports (e.g. `import './globals.css'`).
// TypeScript 6 requires a module declaration for side-effect imports of non-code
// assets; Next.js/Turbopack handles the actual bundling at build time.
declare module '*.css';
