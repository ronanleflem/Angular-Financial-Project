const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeCatalog = path.join(root, 'public', 'parameter_catalog.json');
const docsCatalog = path.join(root, 'docs', 'parameter_catalog.json');

function readIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function fail(message) {
  console.error(`[check:catalog-drift] ${message}`);
  process.exit(1);
}

const runtimeContent = readIfExists(runtimeCatalog);
if (runtimeContent === null) {
  fail(`Missing runtime catalog: ${path.relative(root, runtimeCatalog)}`);
}

const docsContent = readIfExists(docsCatalog);
if (docsContent === null) {
  fail(
    `Missing docs mirror: ${path.relative(root, docsCatalog)}. Run "npm run sync:catalog" to restore it.`
  );
}

if (runtimeContent !== docsContent) {
  fail(
    [
      'Catalog drift detected between public and docs copies.',
      `- Runtime: ${path.relative(root, runtimeCatalog)}`,
      `- Docs: ${path.relative(root, docsCatalog)}`,
      'Run "npm run sync:catalog" and commit both files.'
    ].join('\n')
  );
}

console.log(
  `[check:catalog-drift] OK: ${path.relative(root, runtimeCatalog)} and ${path.relative(
    root,
    docsCatalog
  )} are in sync.`
);
