const { execFileSync } = require('child_process');
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path || '';

if (filePath.match(/\.(ts|tsx|js|jsx|json|md|css)$/)) {
  try {
    execFileSync(
      'npx',
      ['prettier', '--write', filePath],
      {
        cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
        encoding: 'utf8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
  } catch (e) {
    // Prettier errors should not block editing
    if (e.stderr) console.log(e.stderr.trim());
  }
}
