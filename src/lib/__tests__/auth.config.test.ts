import { describe, it, expect } from 'vitest';
import authConfig from '../auth.config';

const redirect = authConfig.callbacks.redirect;
const baseUrl = 'https://app.example.com';
const PREVIEW = 'https://weekly-eats-feat-x-zach-roses-projects.vercel.app';

describe('redirect callback — base branches', () => {
  it('resolves a relative path against baseUrl', () => {
    expect(redirect({ url: '/dashboard', baseUrl })).toBe(`${baseUrl}/dashboard`);
  });
  it('returns a same-origin absolute URL unchanged', () => {
    const url = `${baseUrl}/recipes`;
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('falls back to baseUrl for a foreign origin', () => {
    expect(redirect({ url: 'https://evil.com', baseUrl })).toBe(baseUrl);
  });
});

describe('redirect callback — preview-origin allowlist', () => {
  it('accepts a valid preview origin (no path)', () => {
    expect(redirect({ url: PREVIEW, baseUrl })).toBe(PREVIEW);
  });
  it('accepts a valid preview origin carrying a path', () => {
    const url = `${PREVIEW}/meal-plans`;
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('accepts the production origin', () => {
    const url = 'https://weekly-eats.vercel.app/recipes';
    expect(redirect({ url, baseUrl })).toBe(url);
  });
  it('rejects a foreign origin (→ baseUrl)', () => {
    expect(redirect({ url: 'https://attacker.example/x', baseUrl })).toBe(baseUrl);
  });
  it('rejects a suffix-attack lookalike host (→ baseUrl)', () => {
    const url = 'https://weekly-eats-x-zach-roses-projects.vercel.app.evil.com/cb';
    expect(redirect({ url, baseUrl })).toBe(baseUrl);
  });
});
