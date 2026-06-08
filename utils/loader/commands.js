const path = require('node:path');
const { listJsFilesRecursive } = require('./files');

function loadCommands({ client, baseDir, logger }) {
  const commandsDir = path.join(baseDir, 'commands');
  const files = listJsFilesRecursive(commandsDir);

  for (const filePath of files) {
    const mod = require(filePath);
    if (!mod?.data?.name || typeof mod.execute !== 'function') {
      logger.warn('command.invalid', { filePath });
      continue;
    }

    client.commands.set(mod.data.name, mod);
    logger.info('command.loaded', { name: mod.data.name, file: path.relative(baseDir, filePath) });
  }
}

module.exports = { loadCommands };
