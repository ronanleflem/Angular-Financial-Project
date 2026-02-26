const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'public', 'parameter_catalog.json');
const target = path.join(root, 'docs', 'parameter_catalog.json');

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
}

function run() {
  ensureFile(source);
  const content = fs.readFileSync(source, 'utf8');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  console.log(`Synced catalog: ${path.relative(root, source)} -> ${path.relative(root, target)}`);
}

try {
  run();
} catch (error) {
  console.error(`[sync:catalog] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
