const { execFileSync } = require('child_process');
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path || '';

if (filePath.match(/\.(ts|tsx)$/)) {
  try {
    const output = execFileSync(
      'npx',
      ['tsc', '--noEmit', '--pretty'],
      {
        cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    if (output.trim()) console.log(output.trim());
  } catch (e) {
    // tsc exits non-zero when there are type errors — show them but don't block
    const output = (e.stdout || '') + (e.stderr || '');
    if (output.trim()) console.log(output.trim());
  }
}
