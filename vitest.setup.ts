import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Workaround for Next.js app/router globals if needed in tests
// You can extend here as the test suite grows

// Prevent real DB adapter connection attempts during tests
vi.mock('/Users/zach.rose/weekly-eats/src/lib/mongodb-adapter.ts', () => ({
  default: Promise.resolve({}),
}));

// Ensure a dummy Mongo URI is present if any module checks it
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fake';


