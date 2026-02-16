const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path || '';
if (filePath.includes('package-lock.json')) {
  process.stderr.write('BLOCKED: modify package-lock.json via npm commands only');
  process.exit(2);
}
