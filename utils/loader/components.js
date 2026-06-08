const path = require('node:path');
const { listJsFilesRecursive } = require('./files');

function loadComponents({ client, baseDir, logger }) {
  const componentsDir = path.join(baseDir, 'components');
  const files = listJsFilesRecursive(componentsDir);

  for (const filePath of files) {
    const mod = require(filePath);
    if (!mod?.customIdPrefix || typeof mod.execute !== 'function') {
      logger.warn('component.invalid', { filePath });
      continue;
    }

    client.components.set(mod.customIdPrefix, mod);
    logger.info('component.loaded', { prefix: mod.customIdPrefix, file: path.relative(baseDir, filePath) });
  }
}

module.exports = { loadComponents };
