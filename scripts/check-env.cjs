const fs = require('fs');
const content = fs.readFileSync('.env.local', 'utf8');
content.split('\n').forEach(line => {
  if (line.startsWith('MONGODB_URI') || line.startsWith('PORT')) {
    console.log(line);
  } else if (line.includes('=') && !line.startsWith('#') && line.trim()) {
    console.log(line.split('=')[0] + '=[redacted]');
  }
});
