const path = require('node:path');
const { listJsFilesRecursive } = require('./files');

function loadEvents({ client, baseDir, logger }) {
  const eventsDir = path.join(baseDir, 'events');
  const files = listJsFilesRecursive(eventsDir);

  for (const filePath of files) {
    const mod = require(filePath);
    if (!mod?.name || typeof mod.execute !== 'function') {
      logger.warn('event.invalid', { filePath });
      continue;
    }

    const handler = (...args) => mod.execute(...args, { client });
    if (mod.once) client.once(mod.name, handler);
    else client.on(mod.name, handler);

    logger.info('event.loaded', { name: mod.name, file: path.relative(baseDir, filePath) });
  }
}

module.exports = { loadEvents };
