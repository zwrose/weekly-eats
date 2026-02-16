const { execFileSync } = require('child_process');
const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path || '';

if (filePath.match(/\.(ts|tsx)$/)) {
  try {
    const output = execFileSync(
      'npx',
      ['next', 'lint', '--file', filePath, '--max-warnings=0'],
      {
        cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
        encoding: 'utf8',
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    if (output.trim()) console.log(output.trim());
  } catch (e) {
    if (e.stdout) console.log(e.stdout.trim());
  }
}
