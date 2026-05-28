// test/manual/validate-args.ts
const BRANCH_RE = /^[a-zA-Z0-9._/-]{1,200}$/;
const SLOT_RE = /^[a-zA-Z0-9._-]{1,64}$/;
const HTML_MARKER_FRAGMENTS = ['-->', '<!--'];

function hasMarkerFragment(s: string): boolean {
  return HTML_MARKER_FRAGMENTS.some((f) => s.includes(f));
}

export function validateBranch(branch: string): string {
  if (!branch || typeof branch !== 'string') {
    throw new Error('branch: must be a non-empty string');
  }
  if (branch.length > 200) {
    throw new Error(`branch: too long (${branch.length} > 200)`);
  }
  if (!BRANCH_RE.test(branch)) {
    throw new Error(`branch: contains disallowed characters (allowed: a-zA-Z0-9._/-): ${branch}`);
  }
  if (hasMarkerFragment(branch)) {
    throw new Error(`branch: contains HTML marker fragment: ${branch}`);
  }
  return branch;
}

export function validateSlot(slot: string): string {
  if (!slot || typeof slot !== 'string') {
    throw new Error('slot: must be a non-empty string');
  }
  if (slot.length > 64) {
    throw new Error(`slot: too long (${slot.length} > 64)`);
  }
  if (!SLOT_RE.test(slot)) {
    throw new Error(`slot: contains disallowed characters (allowed: a-zA-Z0-9._-): ${slot}`);
  }
  if (hasMarkerFragment(slot)) {
    throw new Error(`slot: contains HTML marker fragment: ${slot}`);
  }
  return slot;
}

export function sanitizeBranchForFilename(branch: string): string {
  return branch.replace(/\//g, '%2F');
}

export function unsanitizeBranchFromFilename(name: string): string {
  return name.replace(/%2F/g, '/');
}

export function manifestId(branch: string, slot: string): string {
  return `${branch}::${slot}`;
}
