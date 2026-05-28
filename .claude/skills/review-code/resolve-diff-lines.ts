#!/usr/bin/env tsx
/**
 * Resolves review comment lines against a GitHub PR unified diff.
 *
 * Used by the /review skill before posting inline review comments via the
 * GitHub API. Comments anchored to a (file, line) pair that does not fall
 * within a diff hunk on the RIGHT side will be rejected by GitHub with a
 * 422 "Line could not be resolved" error. This script normalizes comments:
 *
 *   - Comment line is inside a hunk on a + or context line -> pass through.
 *   - Comment line is outside any hunk in a file that IS in the diff ->
 *     move to the nearest valid line in that file, prefix body with
 *     "(Re: line <originalLine>) ", and record the move.
 *   - File is not in the diff at all -> drop the comment.
 *
 * Library usage:
 *   import { resolveCommentLines } from "./resolve-diff-lines.js";
 *   const { resolved, moved, dropped } = resolveCommentLines(diff, comments);
 *
 * CLI usage:
 *   npx tsx resolve-diff-lines.ts <diff-path> <review-json-path> --output <out-path>
 *
 * Reference: adapted from loupe-app/loupe's resolve-diff-lines.ts.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface Comment {
  path: string;
  line: number;
  body: string;
  side?: 'RIGHT' | 'LEFT';
}

export interface ResolveResult {
  resolved: Comment[];
  dropped: Array<{ comment: Comment; reason: string }>;
  moved: Array<{ comment: Comment; originalLine: number; newLine: number }>;
}

/**
 * Parse a unified diff and return, for each file path on the RIGHT side,
 * the set of line numbers that are valid anchors for inline comments.
 *
 * A line number is valid if it appears in the new file as either:
 *   - an added line (prefixed with "+"), or
 *   - a context line (prefixed with " ").
 *
 * Deleted lines ("-") don't exist in the new file and are not valid.
 */
function parseDiffLines(diffText: string): Map<string, Set<number>> {
  const validLines = new Map<string, Set<number>>();
  let currentFile: string | null = null;
  let newLine: number | null = null;
  let inHunk = false;

  for (const line of diffText.split('\n')) {
    if (line.startsWith('diff --git')) {
      // New file boundary — exit hunk mode; +++ line will set currentFile.
      inHunk = false;
      currentFile = null;
    } else if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6);
      if (!validLines.has(currentFile)) {
        validLines.set(currentFile, new Set());
      }
      inHunk = false;
    } else if (line.startsWith('+++ ')) {
      // +++ /dev/null (deleted file) or other unusual form — no valid lines.
      currentFile = null;
      inHunk = false;
    } else if (line.startsWith('@@ ')) {
      const m = line.match(/\+(\d+)/);
      if (m && currentFile) {
        newLine = parseInt(m[1], 10);
        inHunk = true;
      } else {
        inHunk = false;
      }
    } else if (inHunk && currentFile && newLine !== null) {
      if (line.startsWith('+')) {
        validLines.get(currentFile)?.add(newLine);
        newLine++;
      } else if (line.startsWith('-')) {
        // Deletion — does not advance the new-file counter.
      } else if (line.startsWith(' ') || line.startsWith('\\')) {
        // Context line or "\ No newline at end of file" marker.
        if (line.startsWith(' ')) {
          validLines.get(currentFile)?.add(newLine);
          newLine++;
        }
      } else {
        // Unrecognized line — assume we've left the hunk body.
        inHunk = false;
      }
    }
  }

  return validLines;
}

/**
 * Resolve each comment against the diff. See module docstring for behavior.
 */
export function resolveCommentLines(diff: string, comments: Comment[]): ResolveResult {
  const validLines = parseDiffLines(diff);
  const resolved: Comment[] = [];
  const dropped: ResolveResult['dropped'] = [];
  const moved: ResolveResult['moved'] = [];

  for (const comment of comments) {
    const fileLines = validLines.get(comment.path);

    if (!fileLines || fileLines.size === 0) {
      dropped.push({ comment, reason: 'file not in diff' });
      continue;
    }

    if (fileLines.has(comment.line)) {
      resolved.push(comment);
      continue;
    }

    // Find nearest valid line by absolute distance; ties go to the lower line.
    let nearest: number | null = null;
    for (const l of fileLines) {
      if (
        nearest === null ||
        Math.abs(l - comment.line) < Math.abs(nearest - comment.line) ||
        (Math.abs(l - comment.line) === Math.abs(nearest - comment.line) && l < nearest)
      ) {
        nearest = l;
      }
    }

    if (nearest === null) {
      // Should be unreachable since fileLines.size > 0, but stay defensive.
      dropped.push({ comment, reason: 'no valid lines in file' });
      continue;
    }

    const movedComment: Comment = {
      ...comment,
      line: nearest,
      body: `(Re: line ${comment.line}) ${comment.body}`,
    };
    resolved.push(movedComment);
    moved.push({ comment: movedComment, originalLine: comment.line, newLine: nearest });
  }

  return { resolved, dropped, moved };
}

// --- CLI entry point ---

interface ReviewFile {
  commit_id?: string;
  body?: string;
  event?: string;
  comments?: Comment[];
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  if (args.length < 2) {
    process.stderr.write(
      'Usage: tsx resolve-diff-lines.ts <diff-path> <review-json-path> [--output <out-path>]\n'
    );
    return 1;
  }

  const diffPath = args[0];
  const reviewPath = args[1];
  const outputIdx = args.indexOf('--output');
  const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : null;

  const diffText = readFileSync(diffPath, 'utf-8');

  let review: ReviewFile;
  try {
    review = JSON.parse(readFileSync(reviewPath, 'utf-8'));
  } catch (err) {
    process.stderr.write(
      `Failed to parse review JSON at ${reviewPath}: ${(err as Error).message}\n`
    );
    return 1;
  }

  if (!review || !Array.isArray(review.comments)) {
    process.stderr.write(`Review JSON at ${reviewPath} is missing a "comments" array.\n`);
    return 1;
  }

  const { resolved, dropped, moved } = resolveCommentLines(diffText, review.comments);

  for (const m of moved) {
    process.stderr.write(`MOVED: ${m.comment.path}:${m.originalLine} -> ${m.newLine}\n`);
  }
  for (const d of dropped) {
    process.stderr.write(`DROPPED: ${d.comment.path}:${d.comment.line} - ${d.reason}\n`);
  }

  review.comments = resolved;
  const output = JSON.stringify(review, null, 2);

  if (outputPath) {
    writeFileSync(outputPath, output);
    process.stderr.write(`Wrote ${resolved.length} comments to ${outputPath}\n`);
  } else {
    process.stdout.write(output);
  }

  return 0;
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  (() => {
    try {
      return process.argv[1] === fileURLToPath(import.meta.url);
    } catch {
      return false;
    }
  })();

if (isDirectRun) {
  process.exit(main(process.argv));
}
