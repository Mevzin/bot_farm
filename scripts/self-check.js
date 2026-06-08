const path = require('node:path');

const { listJsFilesRecursive } = require('../utils/loader/files');

function loadAll(dir) {
  const files = listJsFilesRecursive(dir);
  for (const filePath of files) {
    require(filePath);
  }
  return files.length;
}

function main() {
  const base = path.join(__dirname, '..');
  const count =
    loadAll(path.join(base, 'commands')) +
    loadAll(path.join(base, 'components')) +
    loadAll(path.join(base, 'events')) +
    loadAll(path.join(base, 'utils'));

  console.log(`Self-check OK. Modules loaded: ${count}`);
}

main();
