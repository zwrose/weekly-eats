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
      detail: `Reached ${maxRounds} rounds with ${latestBlocking.length} blocking finding(s) still open.`,
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
