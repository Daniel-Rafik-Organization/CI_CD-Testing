const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const source = path.join(root, 'src', 'greeting.js');
const target = path.join(distDir, 'greeting.js');

fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(source, target);

const marker = path.join(distDir, 'build-info.json');
fs.writeFileSync(
  marker,
  `${JSON.stringify({ builtAt: new Date().toISOString() }, null, 2)}\n`
);

console.log(`Built ${target}`);
