const fs = require('node:fs');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeWriteFileSync(filePath, contents) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, contents);
  fs.renameSync(tempPath, filePath);
}

module.exports = {
  ensureDir,
  safeWriteFileSync
};

