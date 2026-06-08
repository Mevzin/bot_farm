const fs = require('node:fs');
const path = require('node:path');
const { DateTime } = require('luxon');

const { ensureDir } = require('./fs');

function createLogger({ baseDir }) {
  const logsDir = path.join(baseDir, 'logs');
  ensureDir(logsDir);

  function writeLine(level, message, meta) {
    const now = DateTime.local();
    const line = JSON.stringify({
      ts: now.toISO(),
      level,
      message,
      meta: meta ?? null
    });
    const fileName = `${now.toFormat('yyyy-LL-dd')}.log`;
    fs.appendFileSync(path.join(logsDir, fileName), `${line}\n`);
  }

  return {
    info(message, meta) {
      writeLine('info', message, meta);
    },
    warn(message, meta) {
      writeLine('warn', message, meta);
    },
    error(message, meta) {
      writeLine('error', message, meta);
    }
  };
}

module.exports = { createLogger };

