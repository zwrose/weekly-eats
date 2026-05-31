import { describe, it, expect } from 'vitest';
import {
  ServiceError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '@/lib/service-errors';

describe('service-errors', () => {
  it('ValidationError is a ServiceError and an Error carrying the message', () => {
    const err = new ValidationError('Name is required');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe('Name is required');
    expect(err.name).toBe('ValidationError');
  });

  it('NotFoundError / ForbiddenError are distinct subclasses', () => {
    const nf = new NotFoundError('Recipe not found');
    const fb = new ForbiddenError('Forbidden');
    expect(nf).toBeInstanceOf(NotFoundError);
    expect(nf).not.toBeInstanceOf(ForbiddenError);
    expect(fb).toBeInstanceOf(ForbiddenError);
    expect(fb).not.toBeInstanceOf(NotFoundError);
  });

  it('ConflictError carries an optional details string', () => {
    const withDetails = new ConflictError('Food item already exists', 'duplicate of "sugar"');
    const without = new ConflictError('Food item already exists');
    expect(withDetails).toBeInstanceOf(ConflictError);
    expect(withDetails.details).toBe('duplicate of "sugar"');
    expect(without.details).toBeUndefined();
  });
});
