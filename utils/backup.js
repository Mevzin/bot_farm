const fs = require('node:fs');
const path = require('node:path');
const { DateTime } = require('luxon');

const { ensureDir } = require('./fs');

function copyRecursiveSync(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function cleanupOldBackups({ backupsDir, retentionDays, logger }) {
  if (!fs.existsSync(backupsDir)) return;
  const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
  const cutoff = DateTime.local().minus({ days: retentionDays }).toMillis();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(backupsDir, entry.name);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) {
      fs.rmSync(full, { recursive: true, force: true });
      logger.info('backup.cleanup', { folder: full });
    }
  }
}

function createBackup({ baseDir, logger }) {
  const databaseDir = path.join(baseDir, 'database');
  if (!fs.existsSync(databaseDir)) return;

  const backupsDir = path.join(databaseDir, 'backups');
  ensureDir(backupsDir);

  const stamp = DateTime.local().toFormat("yyyy-LL-dd_HH-mm-ss");
  const outDir = path.join(backupsDir, stamp);
  ensureDir(outDir);

  for (const entry of fs.readdirSync(databaseDir, { withFileTypes: true })) {
    if (entry.name === 'backups') continue;
    const src = path.join(databaseDir, entry.name);
    const dest = path.join(outDir, entry.name);
    copyRecursiveSync(src, dest);
  }

  logger.info('backup.created', { outDir });
}

function startBackupScheduler({ baseDir, logger, botConfig }) {
  const backupIntervalMinutes = botConfig?.backupIntervalMinutes ?? 10;
  const backupRetentionDays = botConfig?.backupRetentionDays ?? 7;

  const intervalMs = Math.max(1, backupIntervalMinutes) * 60_000;
  setInterval(() => {
    try {
      createBackup({ baseDir, logger });
      cleanupOldBackups({
        backupsDir: path.join(baseDir, 'database', 'backups'),
        retentionDays: Math.max(1, backupRetentionDays),
        logger
      });
    } catch (err) {
      logger.error('backup.failed', { message: err?.message, stack: err?.stack });
    }
  }, intervalMs).unref();
}

module.exports = {
  createBackup,
  startBackupScheduler
};
