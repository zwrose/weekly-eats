// test/manual/pr-comment.ts
import { execFile } from 'node:child_process';
import { validateBranch, validateSlot } from './validate-args.js';

// Run execFile with explicit opts ({}) so the callback is always the 4th arg,
// matching the test mock signature (cmd, args, opts, cb). The callback receives
// (err, { stdout, stderr }) following the promisify convention.
function execFileAsync(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, {}, (err, result: unknown) => {
      if (err) reject(err);
      else if (typeof result === 'object' && result !== null && 'stdout' in result) {
        // Test mock calls cb(null, { stdout, stderr }) — 2-arg convention
        resolve(result as { stdout: string; stderr: string });
      } else {
        // Real execFile calls cb(err, stdout, stderr) — 3-arg convention
        // In this branch, result is actually the stdout string
        resolve({ stdout: result as unknown as string, stderr: '' });
      }
    });
  });
}

export interface Marker {
  open: string;
  close: string;
}

export function buildMarker(branch: string, slot: string): Marker {
  validateBranch(branch);
  validateSlot(slot);
  return {
    open: `<!-- manual-testing-plan: ${branch} :: ${slot} -->`,
    close: `<!-- /manual-testing-plan -->`,
  };
}

export async function findPrForBranch(
  branch: string
): Promise<{ number: number; url: string } | null> {
  validateBranch(branch);
  try {
    const { stdout } = await execFileAsync('gh', [
      'pr',
      'list',
      '--head',
      branch,
      '--json',
      'number,url',
      '--limit',
      '1',
    ]);
    const arr = JSON.parse(stdout);
    return arr.length > 0 ? { number: arr[0].number, url: arr[0].url } : null;
  } catch {
    return null;
  }
}

export async function findExistingComment(
  prNumber: number,
  marker: Marker
): Promise<number | null> {
  const { stdout } = await execFileAsync('gh', [
    'api',
    `repos/{owner}/{repo}/issues/${prNumber}/comments`,
    '--paginate',
  ]);
  const comments: Array<{ id: number; body: string }> = JSON.parse(stdout);
  for (const c of comments) if (c.body.includes(marker.open)) return c.id;
  return null;
}

export async function findPrAndComment(
  branch: string,
  slot: string
): Promise<{ pr: { number: number; url: string }; commentId: number | null } | null> {
  const pr = await findPrForBranch(branch);
  if (!pr) return null;
  const marker = buildMarker(branch, slot);
  const commentId = await findExistingComment(pr.number, marker);
  return { pr, commentId };
}

export async function postOrEditPrComment(
  prNumber: number,
  body: string,
  existingCommentId: number | null
): Promise<{ commentId: number }> {
  if (existingCommentId == null) {
    const { stdout } = await execFileAsync('gh', [
      'api',
      `repos/{owner}/{repo}/issues/${prNumber}/comments`,
      '-f',
      `body=${body}`,
    ]);
    return { commentId: JSON.parse(stdout).id };
  }
  await execFileAsync('gh', [
    'api',
    '--method',
    'PATCH',
    `repos/{owner}/{repo}/issues/comments/${existingCommentId}`,
    '-f',
    `body=${body}`,
  ]);
  return { commentId: existingCommentId };
}

export function sanitizeBlockSummary(s: string): string {
  if (s.length > 120) throw new Error(`summary too long (${s.length} > 120): ${s.slice(0, 60)}…`);
  if (!/^[\x20-\x7E]+$/.test(s))
    throw new Error(`summary contains non-ASCII or control chars: ${JSON.stringify(s)}`);
  if (s.includes('`')) throw new Error(`summary contains backtick: ${s}`);
  return s;
}
