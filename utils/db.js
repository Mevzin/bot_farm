const fs = require('node:fs');
const path = require('node:path');

const { ensureDir, safeWriteFileSync } = require('./fs');

function getGuildFilePath({ baseDir, guildId }) {
  return path.join(baseDir, 'database', 'guilds', `${guildId}.json`);
}

function createDefaultGuildDb() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    config: {
      logChannelId: '',
      registryChannelId: '',
      rankingChannelId: '',
      goalChannelId: '',
      adminRoleIds: {
        master: '',
        admin: ''
      },
      statsMessageId: '',
      weeklyResetEnabled: true,
      lastWeeklyResetAt: '',
      memberRoleId: '',
      approverRoleId: '',
      logsEnabled: true,
      dmEnabled: true
    },
    items: [],
    members: [],
    chest: {
      stockByItemId: {},
      movements: []
    },
    dirtyMoney: {
      byUserId: {},
      records: []
    },
    farm: {
      byUserId: {},
      records: []
    },
    goal: {
      campaignName: '',
      target: 0,
      current: 0,
      goalMessageId: '',
      contributionsByUserId: {},
      contributions: []
    },
    washes: {
      records: [],
      totalByUserId: {}
    },
    registrations: {
      pending: {}
    },
    stats: {
      byUserId: {}
    }
  };
}

function createDb({ baseDir, logger }) {
  const guildsDir = path.join(baseDir, 'database', 'guilds');
  ensureDir(guildsDir);

  const writeQueues = new Map();
  const cache = new Map();

  function cloneDb(db) {
    return JSON.parse(JSON.stringify(db));
  }

  function readGuildDbRef(guildId) {
    const cached = cache.get(guildId);
    if (cached) return cached;
    const filePath = getGuildFilePath({ baseDir, guildId });
    if (!fs.existsSync(filePath)) {
      const initial = createDefaultGuildDb();
      safeWriteFileSync(filePath, JSON.stringify(initial, null, 2));
      cache.set(guildId, initial);
      return initial;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    cache.set(guildId, parsed);
    return parsed;
  }

  function readGuildDb(guildId) {
    return cloneDb(readGuildDbRef(guildId));
  }

  function overwriteGuildDb(guildId, db) {
    const filePath = getGuildFilePath({ baseDir, guildId });
    db.updatedAt = new Date().toISOString();
    safeWriteFileSync(filePath, JSON.stringify(db, null, 2));
    cache.set(guildId, db);
  }

  function enqueueWrite(guildId, fn) {
    const prev = writeQueues.get(guildId) ?? Promise.resolve();
    const next = prev
      .catch(() => { })
      .then(async () => {
        const filePath = getGuildFilePath({ baseDir, guildId });
        const db = readGuildDbRef(guildId);
        const result = await fn(db);
        db.updatedAt = new Date().toISOString();
        safeWriteFileSync(filePath, JSON.stringify(db, null, 2));
        cache.set(guildId, db);
        return result;
      })
      .catch((err) => {
        logger.error('db.write.failed', { guildId, message: err?.message, stack: err?.stack });
        throw err;
      });

    writeQueues.set(guildId, next);
    return next;
  }

  return {
    readGuildDb,
    readGuildDbRef,
    overwriteGuildDb,
    updateGuildDb(guildId, updater) {
      return enqueueWrite(guildId, updater);
    },
    ensureGuildDb(guildId) {
      readGuildDbRef(guildId);
    }
  };
}

module.exports = { createDb, createDefaultGuildDb };
