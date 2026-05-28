import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRounds, type Finding } from '../circuit-breaker';

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

function writeRound(
  dir: string,
  n: number,
  findings: Finding[],
  resolutions?: Array<{ file: string; title: string; action: string }>
): void {
  const rd = join(dir, `round-${n}`);
  mkdirSync(rd, { recursive: true });
  writeFileSync(join(rd, 'compiled.json'), JSON.stringify({ findings }));
  if (resolutions) {
    writeFileSync(
      join(rd, 'resolutions.json'),
      JSON.stringify({ resolutions: resolutions.map((r) => ({ id: 'x', ...r })) })
    );
  }
}

describe('loadRounds', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cb-test-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads rounds in numeric order', () => {
    writeRound(dir, 2, [I('b')]);
    writeRound(dir, 1, [I('a')]);
    writeRound(dir, 10, [I('c')]);
    const { rounds } = loadRounds(dir);
    expect(rounds.map((r) => r.round)).toEqual([1, 2, 10]);
  });

  it('excludes findings whose identity was skipped in any round', () => {
    writeRound(
      dir,
      1,
      [I('Missing filter')],
      [{ file: 'src/a.ts', title: 'Missing filter', action: 'skip' }]
    );
    writeRound(dir, 2, [I('Missing filter'), I('Other bug')]);
    const { rounds } = loadRounds(dir);
    expect(rounds[1].findings.map((f) => f.title)).toEqual(['Other bug']);
  });

  it('keeps findings for fix/fix-with-guidance resolutions', () => {
    writeRound(dir, 1, [I('Keep me')], [{ file: 'src/a.ts', title: 'Keep me', action: 'fix' }]);
    const { rounds } = loadRounds(dir);
    expect(rounds[0].findings).toHaveLength(1);
  });
});
