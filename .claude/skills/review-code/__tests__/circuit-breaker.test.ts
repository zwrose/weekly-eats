import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  findingIdentity,
  checkCircuitBreaker,
  type Finding,
  type RoundFindings,
} from '../circuit-breaker';

function round(num: number, findings: Finding[]): RoundFindings {
  return { round: num, findings };
}

const I = (title: string, file = 'src/a.ts'): Finding => ({
  id: 'x-001',
  severity: 'Important',
  dimension: 'Code',
  title,
  file,
  line: 1,
  body: '',
  suggestion: null,
});

const minor = (title: string, file = 'src/a.ts'): Finding => ({
  ...I(title, file),
  severity: 'Minor',
});

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeTitle('Missing userId Filter!')).toBe('missing userid filter');
    expect(normalizeTitle('  Extra   spaces  ')).toBe('extra spaces');
    expect(normalizeTitle('Punctuation, removed.')).toBe('punctuation removed');
  });
});

describe('findingIdentity', () => {
  it('combines file and normalized title', () => {
    expect(findingIdentity({ file: 'src/a.ts', title: 'Missing Filter' })).toBe(
      'src/a.ts::missing filter'
    );
  });
  it('treats null file as empty string', () => {
    expect(findingIdentity({ file: null, title: 'X' })).toBe('::x');
  });
});

describe('checkCircuitBreaker', () => {
  it('does not halt with no rounds', () => {
    expect(checkCircuitBreaker([], 7).halt).toBe(false);
  });

  it('does not halt on a single round still in progress', () => {
    expect(checkCircuitBreaker([round(1, [I('a'), I('b')])], 7).halt).toBe(false);
  });

  it('halts on a recurring finding across two consecutive rounds', () => {
    const r = [round(1, [I('Missing userId filter')]), round(2, [I('Missing userId filter')])];
    const res = checkCircuitBreaker(r, 7);
    expect(res.halt).toBe(true);
    expect(res.reason).toBe('recurring-finding');
  });

  it('ignores Minor/Nit recurrence (only blocking findings count)', () => {
    const r = [round(1, [minor('style x')]), round(2, [minor('style x')])];
    expect(checkCircuitBreaker(r, 7).halt).toBe(false);
  });

  it('does not halt when blocking findings strictly decrease', () => {
    const r = [round(1, [I('a'), I('b'), I('c')]), round(2, [I('d'), I('e')]), round(3, [I('f')])];
    expect(checkCircuitBreaker(r, 7).halt).toBe(false);
  });

  it('halts on no net progress over two transitions with distinct findings', () => {
    const r = [round(1, [I('a'), I('b')]), round(2, [I('c'), I('d')]), round(3, [I('e'), I('g')])];
    const res = checkCircuitBreaker(r, 7);
    expect(res.halt).toBe(true);
    expect(res.reason).toBe('no-net-progress');
  });

  it('does not halt on a single flat transition (needs two)', () => {
    const r = [round(1, [I('a'), I('b')]), round(2, [I('c'), I('d')])];
    expect(checkCircuitBreaker(r, 7).halt).toBe(false);
  });

  it('halts at max iterations when blocking findings remain', () => {
    const r = [round(1, [I('a')]), round(2, [I('a')])];
    const res = checkCircuitBreaker(r, 2);
    expect(res.halt).toBe(true);
    expect(res.reason).toBe('max-iterations');
  });

  it('does not halt at max iterations once blocking findings are resolved', () => {
    const r = [round(1, [I('a')]), round(2, [])];
    expect(checkCircuitBreaker(r, 2).halt).toBe(false);
  });
});
