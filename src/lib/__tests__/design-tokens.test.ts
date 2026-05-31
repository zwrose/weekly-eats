import { describe, it, expect } from 'vitest';
import { tokens } from '../design-tokens';

describe('design tokens', () => {
  it('exposes the dark surface ramp', () => {
    expect(tokens.surface.base).toBe('#0f1115');
    expect(tokens.surface.raised).toBe('#181b21');
    expect(tokens.surface.sheet).toBe('#1a1e26');
  });

  it('exposes section accents and the utility accent', () => {
    expect(tokens.section.plans).toBe('#7aa7ff');
    expect(tokens.section.shop).toBe('#6fcf97');
    expect(tokens.section.recipes).toBe('#e8a86b');
    expect(tokens.section.pantry).toBe('#c79bff');
    expect(tokens.accentUtility).toBe('#9aa4b3');
  });

  it('exposes meal domain colors and semantic state colors', () => {
    expect(tokens.meal.breakfast).toBe('#e8c97a');
    expect(tokens.state.danger).toBe('#e87a8a');
    expect(tokens.state.warn).toBe('#f0c674');
  });

  it('exposes numeric spacing/radius scales and shadow strings', () => {
    expect(tokens.space.base).toBe(14);
    expect(tokens.radius.pill).toBe(999);
    expect(tokens.shadow.card).toBe('0 0 0 3px rgba(122,167,255,0.08)');
  });
});

describe('shopping on-accent ink tokens', () => {
  it('exposes dark on-accent ink for the shop section fill', () => {
    expect(tokens.onAccent.shop).toBe('#0c1a13');
  });
  it('exposes dark on-accent ink for the pantry section fill', () => {
    expect(tokens.onAccent.pantry).toBe('#1a0f24');
  });
  it('exposes dark on-danger ink for danger fills (SKIP segment / retry)', () => {
    expect(tokens.onDanger).toBe('#1a0f0f');
  });
});
