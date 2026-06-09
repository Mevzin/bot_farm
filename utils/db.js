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
      purchaseLogChannelId: '',
      salesLogChannelId: '',
      financeChannelId: '',
      chestChannelId: '',
      registrationChannelId: '',
      proofChannelId: '',
      registryChannelId: '',
      rankingChannelId: '',
      goalChannelId: '',
      adminRoleIds: {
        master: '',
        admin: ''
      },
      roleIds: {
        leader: '',
        administration: '',
        management: '',
        member: '',
        recruiter: ''
      },
      statsMessageId: '',
      weeklyResetEnabled: true,
      lastWeeklyResetAt: '',
      memberRoleId: '',
      approverRoleId: '',
      metaEnabled: true,
      donationEnabled: true,
      rankingEnabled: true,
      registrationEnabled: true,
      logsEnabled: true,
      dmEnabled: true,
      washPercentage: 75,
      salePercentage: 30,
      factionBalance: 0
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
    purchases: {
      records: []
    },
    sales: {
      records: []
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

function normalizeGuildDb(db) {
  const defaults = createDefaultGuildDb();
  const source = db && typeof db === 'object' ? db : {};
  const normalized = {
    ...defaults,
    ...source,
    config: {
      ...defaults.config,
      ...(source.config ?? {}),
      adminRoleIds: {
        ...defaults.config.adminRoleIds,
        ...(source.config?.adminRoleIds ?? {})
      },
      roleIds: {
        ...defaults.config.roleIds,
        ...(source.config?.roleIds ?? {})
      }
    },
    chest: {
      ...defaults.chest,
      ...(source.chest ?? {})
    },
    dirtyMoney: {
      ...defaults.dirtyMoney,
      ...(source.dirtyMoney ?? {})
    },
    farm: {
      ...defaults.farm,
      ...(source.farm ?? {})
    },
    goal: {
      ...defaults.goal,
      ...(source.goal ?? {})
    },
    purchases: {
      ...defaults.purchases,
      ...(source.purchases ?? {})
    },
    sales: {
      ...defaults.sales,
      ...(source.sales ?? {})
    },
    washes: {
      ...defaults.washes,
      ...(source.washes ?? {})
    },
    registrations: {
      ...defaults.registrations,
      ...(source.registrations ?? {})
    },
    stats: {
      ...defaults.stats,
      ...(source.stats ?? {})
    }
  };

  if (!normalized.config.proofChannelId && normalized.config.registryChannelId) {
    normalized.config.proofChannelId = normalized.config.registryChannelId;
  }

  if (!normalized.config.financeChannelId && normalized.config.farmLogChannelId) {
    normalized.config.financeChannelId = normalized.config.farmLogChannelId;
  }

  if (!normalized.config.chestChannelId && normalized.config.registryChannelId) {
    normalized.config.chestChannelId = normalized.config.registryChannelId;
  }

  if (!normalized.config.roleIds.leader && normalized.config.adminRoleIds.master) {
    normalized.config.roleIds.leader = normalized.config.adminRoleIds.master;
  }
  if (!normalized.config.roleIds.administration && normalized.config.adminRoleIds.admin) {
    normalized.config.roleIds.administration = normalized.config.adminRoleIds.admin;
  }
  if (!normalized.config.roleIds.member && normalized.config.memberRoleId) {
    normalized.config.roleIds.member = normalized.config.memberRoleId;
  }
  if (!normalized.config.roleIds.recruiter && normalized.config.approverRoleId) {
    normalized.config.roleIds.recruiter = normalized.config.approverRoleId;
  }

  normalized.config.washPercentage = Math.max(1, Math.min(100, Number(normalized.config.washPercentage ?? 75) || 75));
  normalized.config.salePercentage = Math.max(1, Math.min(100, Number(normalized.config.salePercentage ?? 30) || 30));
  normalized.config.factionBalance = Math.max(0, Number(normalized.config.factionBalance ?? 0) || 0);

  return normalized;
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
      const initial = normalizeGuildDb(createDefaultGuildDb());
      safeWriteFileSync(filePath, JSON.stringify(initial, null, 2));
      cache.set(guildId, initial);
      return initial;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = normalizeGuildDb(JSON.parse(raw));
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

module.exports = { createDb, createDefaultGuildDb, normalizeGuildDb };
