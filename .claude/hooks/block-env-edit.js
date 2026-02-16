const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const filePath = input.tool_input?.file_path || '';
if (filePath.includes('.env')) {
  process.stderr.write('BLOCKED: .env files should not be edited by Claude');
  process.exit(2);
}
