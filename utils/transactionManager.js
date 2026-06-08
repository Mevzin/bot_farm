function createTransactionManager({ db, lockManager, logger }) {
  async function runTransaction({ guildId, key, ttlMs, mutate, afterCommit }) {
    const lockKey = lockManager.lockKey(['tx', guildId, key]);
    return lockManager.withLock({ key: lockKey, ttlMs: ttlMs ?? 30_000 }, async () => {
      const before = db.readGuildDbRef(guildId);
      const beforeSnapshot = JSON.parse(JSON.stringify(before));

      let result;
      try {
        result = await db.updateGuildDb(guildId, async (dbRef) => {
          await mutate(dbRef);
        });
      } catch (err) {
        throw err;
      }

      try {
        if (typeof afterCommit === 'function') {
          await afterCommit();
        }
        return result;
      } catch (err) {
        try {
          db.overwriteGuildDb(guildId, beforeSnapshot);
        } catch (rollbackErr) {
          logger.error('tx.rollback.failed', { guildId, message: rollbackErr?.message, stack: rollbackErr?.stack });
        }
        throw err;
      }
    });
  }

  return { runTransaction };
}

module.exports = { createTransactionManager };

