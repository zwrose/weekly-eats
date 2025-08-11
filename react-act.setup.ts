// Configure React's test environment properly
// This must happen before any React code is imported

// Tell React we're in a test environment that supports act
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;