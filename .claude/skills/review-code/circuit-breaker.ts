import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Severity = 'Critical' | 'Important' | 'Minor' | 'Nit';

export interface Finding {
  id: string;
  severity: Severity;
  dimension: string;
  title: string;
  file: string | null;
  line: number | null;
  body: string;
  suggestion: string | null;
  tradeoff?: boolean;
}

export interface RoundFindings {
  round: number;
  findings: Finding[];
}

export type CircuitBreakerReason = 'recurring-finding' | 'no-net-progress' | 'max-iterations';

export interface CircuitBreakerResult {
  halt: boolean;
  reason: CircuitBreakerReason | null;
  detail: string;
}

const BLOCKING: ReadonlySet<Severity> = new Set<Severity>(['Critical', 'Important']);

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findingIdentity(finding: Pick<Finding, 'file' | 'title'>): string {
  return `${finding.file ?? ''}::${normalizeTitle(finding.title)}`;
}

function blockingFindings(round: RoundFindings): Finding[] {
  return round.findings.filter((f) => BLOCKING.has(f.severity));
}

/**
 * Decide whether the auto-fix loop is stuck and should halt.
 *
 * Contract: `rounds` are chronological (round 1 first). Each round's `findings`
 * are that round's compiled findings with deliberately-skipped findings already
 * removed by the caller — skipped findings must not count toward recurrence or
 * progress, or the loop would never converge.
 *
 * Un-sensitive by design: normal 2-3 round convergence never trips it.
 */
export function checkCircuitBreaker(
  rounds: RoundFindings[],
  maxRounds: number
): CircuitBreakerResult {
  const n = rounds.length;
  if (n === 0) {
    return { halt: false, reason: null, detail: 'no rounds yet' };
  }

  const latestBlocking = blockingFindings(rounds[n - 1]);

  // Criterion 3: max iterations (only halts while blocking findings remain).
  if (n >= maxRounds && latestBlocking.length > 0) {
    return {
      halt: true,
      reason: 'max-iterations',
      detail: `Reached ${maxRounds} rounds; the latest review still showed ${latestBlocking.length} blocking finding(s) (the final round's fixes are committed but not yet re-reviewed).`,
    };
  }

  // Criterion 1: recurring finding across the two most recent rounds.
  if (n >= 2) {
    const prevIds = new Set(blockingFindings(rounds[n - 2]).map(findingIdentity));
    const recurring = latestBlocking.filter((f) => prevIds.has(findingIdentity(f)));
    if (recurring.length > 0) {
      return {
        halt: true,
        reason: 'recurring-finding',
        detail: `${recurring.length} blocking finding(s) recurred after a fix was committed: ${recurring
          .map(findingIdentity)
          .join('; ')}`,
      };
    }
  }

  // Criterion 2: no net progress across two consecutive round-transitions.
  if (n >= 3) {
    const count = (i: number): number => blockingFindings(rounds[i]).length;
    const cN = count(n - 1);
    const cN1 = count(n - 2);
    const cN2 = count(n - 3);
    if (cN > 0 && cN >= cN1 && cN1 >= cN2) {
      return {
        halt: true,
        reason: 'no-net-progress',
        detail: `Blocking-finding count did not decrease over two rounds (${cN2} → ${cN1} → ${cN}).`,
      };
    }
  }

  return { halt: false, reason: null, detail: 'progressing' };
}

interface CompiledFile {
  findings: Finding[];
}

interface Resolution {
  id: string;
  file?: string | null;
  title?: string;
  action: 'fix' | 'fix-with-guidance' | 'skip';
  guidance?: string;
}

interface ResolutionsFile {
  resolutions: Resolution[];
}

/**
 * Read `<sessionDir>/round-N/compiled.json` for every round, in numeric order.
 * Finding identities that were deliberately skipped in ANY round's
 * `resolutions.json` are removed from every round, so the circuit breaker never
 * counts a finding the user chose to leave alone.
 */
export function loadRounds(sessionDir: string): {
  rounds: RoundFindings[];
  skipped: Set<string>;
} {
  const dirs = readdirSync(sessionDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^round-\d+$/.test(e.name))
    .map((e) => ({ name: e.name, num: Number(e.name.slice('round-'.length)) }))
    .sort((a, b) => a.num - b.num);

  const skipped = new Set<string>();
  for (const { name } of dirs) {
    const rp = join(sessionDir, name, 'resolutions.json');
    if (!existsSync(rp)) continue;
    const res = JSON.parse(readFileSync(rp, 'utf8')) as ResolutionsFile;
    for (const r of res.resolutions) {
      if (r.action === 'skip') {
        skipped.add(findingIdentity({ file: r.file ?? '', title: r.title ?? '' }));
      }
    }
  }

  const rounds: RoundFindings[] = [];
  for (const { name, num } of dirs) {
    const cp = join(sessionDir, name, 'compiled.json');
    if (!existsSync(cp)) continue;
    const compiled = JSON.parse(readFileSync(cp, 'utf8')) as CompiledFile;
    rounds.push({
      round: num,
      findings: compiled.findings.filter((f) => !skipped.has(findingIdentity(f))),
    });
  }
  return { rounds, skipped };
}

function main(): void {
  const [sessionDir, maxRoundsArg] = process.argv.slice(2);
  if (!sessionDir) {
    console.error('Usage: circuit-breaker.ts <session-dir> [max-rounds=7]');
    process.exit(2);
  }
  const maxRounds = Number(maxRoundsArg ?? '7');
  const { rounds } = loadRounds(sessionDir);
  const result = checkCircuitBreaker(rounds, maxRounds);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
