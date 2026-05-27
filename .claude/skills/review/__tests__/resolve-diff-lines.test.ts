import { describe, it, expect } from 'vitest';
import { resolveCommentLines } from '../resolve-diff-lines.js';

describe('resolveCommentLines', () => {
  it('passes through comments anchored to lines inside a diff hunk', () => {
    const diff = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,4 @@
 line1
+line2
 line3
 line4`;
    const comments = [{ path: 'foo.ts', line: 2, body: 'test comment' }];
    const result = resolveCommentLines(diff, comments);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]).toEqual(comments[0]);
    expect(result.dropped).toEqual([]);
    expect(result.moved).toEqual([]);
  });

  it('moves a comment outside any hunk to the nearest valid line with a Re: prefix', () => {
    const diff = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -10,3 +10,4 @@
 line10
+line11
 line12
 line13`;
    const comments = [{ path: 'foo.ts', line: 99, body: 'out-of-hunk' }];
    const result = resolveCommentLines(diff, comments);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].body).toContain('(Re: line 99)');
    expect(result.resolved[0].body).toContain('out-of-hunk');
    expect(result.moved).toHaveLength(1);
    expect(result.moved[0].originalLine).toBe(99);
  });

  it('drops comments for files not in the diff', () => {
    const diff = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1,1 +1,2 @@
 line1
+line2`;
    const comments = [{ path: 'missing.ts', line: 1, body: 'x' }];
    const result = resolveCommentLines(diff, comments);
    expect(result.resolved).toEqual([]);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0].reason).toBe('file not in diff');
  });

  it('handles new files (all + lines) correctly', () => {
    const diff = `diff --git a/new.ts b/new.ts
new file mode 100644
--- /dev/null
+++ b/new.ts
@@ -0,0 +1,3 @@
+line1
+line2
+line3`;
    const comments = [{ path: 'new.ts', line: 2, body: 'on new file' }];
    const result = resolveCommentLines(diff, comments);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]).toEqual(comments[0]);
    expect(result.dropped).toEqual([]);
  });

  it('handles multiple hunks in one file', () => {
    const diff = `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1,2 +1,3 @@
 line1
+line2
 line3
@@ -10,2 +11,3 @@
 line11
+line12
 line13`;
    const comments = [
      { path: 'foo.ts', line: 2, body: 'first hunk' },
      { path: 'foo.ts', line: 12, body: 'second hunk' },
    ];
    const result = resolveCommentLines(diff, comments);
    expect(result.resolved).toHaveLength(2);
    expect(result.dropped).toEqual([]);
    expect(result.moved).toEqual([]);
  });
});
