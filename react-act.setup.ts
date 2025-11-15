// Configure React's test environment properly
// This must happen before any React code is imported

// Tell React we're in a test environment that supports act
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Set up ReadableStream EARLY - before any Next.js modules load
// This must be in the first setup file to ensure it's available when Next.js code runs
// undici (used by Next.js) requires ReadableStream to be available for webidl checks

// Import native ReadableStream from Node.js (Node 18+)
// This is what undici expects and will pass webidl.is.ReadableStream() checks
import { ReadableStream as NodeReadableStream } from 'stream/web';

// Import polyfill as fallback (shouldn't be needed in Node.js, but for safety)
import { ReadableStream as PolyfillReadableStream } from 'web-streams-polyfill';

// Set up ReadableStream synchronously
// Always use Node.js native ReadableStream when available (Node 18+)
// This ensures compatibility with undici's webidl checks
(function setupReadableStream() {
  // Prefer Node.js native ReadableStream - this is what undici expects
  const ReadableStreamToUse = NodeReadableStream || PolyfillReadableStream;
  
  // Always explicitly set on globalThis to ensure undici finds it
  // This is critical - undici's webidl checks look for ReadableStream on globalThis
  // Use type assertion because Node.js ReadableStream is compatible at runtime
  // but TypeScript sees different type signatures between Node.js and DOM types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ReadableStream = ReadableStreamToUse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).ReadableStream = ReadableStreamToUse;
  
  // Also set on window for jsdom compatibility
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ReadableStream = ReadableStreamToUse;
  }
})();