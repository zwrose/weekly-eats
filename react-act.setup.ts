// Configure React's test environment properly
// This must happen before any React code is imported

// Tell React we're in a test environment that supports act
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Set up ReadableStream EARLY - before any Next.js modules load
// undici (used by Next.js) requires ReadableStream to be available for webidl checks

// Import native ReadableStream from Node.js (available since Node 18)
import { ReadableStream as NodeReadableStream } from 'stream/web';

// Set up ReadableStream synchronously
// Always explicitly set on globalThis to ensure undici finds it
(function setupReadableStream() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ReadableStream = NodeReadableStream;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).ReadableStream = NodeReadableStream;

  // Also set on window for jsdom compatibility
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ReadableStream = NodeReadableStream;
  }
})();
