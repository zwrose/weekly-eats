import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logError, AUTH_ERRORS, FOOD_ITEM_ERRORS, API_ERRORS } from '../errors';

// Mock console.error
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('errors', () => {
  describe('logError', () => {
    it('logs error with context', () => {
      const error = new Error('Test error');
      const context = 'Test Context';
      
      logError(context, error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Test Context] Error:',
        expect.objectContaining({
          message: 'Test error',
          stack: expect.stringContaining('Test error'),
          timestamp: expect.any(String),
        })
      );
    });

    it('handles string errors', () => {
      const error = 'String error message';
      const context = 'Test Context';
      
      logError(context, error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Test Context] Error:',
        expect.objectContaining({
          message: 'String error message',
          stack: undefined,
          timestamp: expect.any(String),
        })
      );
    });

    it('handles unknown error types', () => {
      const error = { custom: 'error object' };
      const context = 'Test Context';
      
      logError(context, error);
      
      expect(console.error).toHaveBeenCalledWith(
        '[Test Context] Error:',
        expect.objectContaining({
          message: '[object Object]',
          stack: undefined,
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('error constants', () => {
    it('has AUTH_ERRORS defined', () => {
      expect(AUTH_ERRORS).toBeDefined();
      expect(AUTH_ERRORS.UNAUTHORIZED).toBeDefined();
      expect(AUTH_ERRORS.FORBIDDEN).toBeDefined();
    });

    it('has FOOD_ITEM_ERRORS defined', () => {
      expect(FOOD_ITEM_ERRORS).toBeDefined();
      expect(FOOD_ITEM_ERRORS.NAME_REQUIRED).toBeDefined();
      expect(FOOD_ITEM_ERRORS.FOOD_ITEM_NOT_FOUND).toBeDefined();
    });

    it('has API_ERRORS defined', () => {
      expect(API_ERRORS).toBeDefined();
      expect(API_ERRORS.INTERNAL_SERVER_ERROR).toBeDefined();
    });
  });
});
