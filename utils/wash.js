const fs = require('node:fs');
const path = require('node:path');
const { DateTime } = require('luxon');

const { ensureDir } = require('./fs');
const { refreshStatsMessage } = require('./stats');
const { sendGuildLog } = require('./audit');
const { EMOJIS } = require('./constants');
const { getWashPercentage } = require('./financeSettings');

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

async function commitWash({ client, baseDir, guildId, userId, adminUser, dirtyAmount }) {
  const dbBefore = client.db.readGuildDb(guildId);
  const washPercentage = getWashPercentage(dbBefore);
  const cleanAmount = Math.floor((Number(dirtyAmount) * washPercentage) / 100);
  const stamp = DateTime.local();
  const washId = `wash_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;

  let remainingDirty = 0;
  let totalClean = 0;

  await client.tx.runTransaction({
    guildId,
    key: `wash:${userId}`,
    ttlMs: 25_000,
    mutate: async (db) => {
      if (!db.washes.records) db.washes.records = [];
      if (!db.washes.totalByUserId) db.washes.totalByUserId = {};

      if (!db.dirtyMoney.byUserId[userId]) db.dirtyMoney.byUserId[userId] = { dirtyTotal: 0, cleanTotal: 0 };

      const totals = db.dirtyMoney.byUserId[userId];
      const available = Number(totals.dirtyTotal ?? 0);
      if (dirtyAmount > available) {
        const err = new Error('INSUFFICIENT_DIRTY');
        err.code = 'INSUFFICIENT_DIRTY';
        throw err;
      }

      totals.dirtyTotal -= dirtyAmount;
      totals.cleanTotal += cleanAmount;

      remainingDirty = totals.dirtyTotal;
      totalClean = totals.cleanTotal;

      if (!db.washes.totalByUserId[userId]) db.washes.totalByUserId[userId] = 0;
      db.washes.totalByUserId[userId] += dirtyAmount;

      const record = {
        id: washId,
        userId,
        dirtyAmount,
        cleanAmount,
        adminId: adminUser?.id ?? '',
        createdAt: stamp.toISO()
      };
      db.washes.records.push(record);
    },
    afterCommit: async () => {
      const outDir = path.join(baseDir, 'database', 'washes', stamp.toFormat('yyyy-LL-dd'));
      ensureDir(outDir);
      fs.writeFileSync(
        path.join(outDir, `${washId}_${guildId}.json`),
        JSON.stringify(
          {
            guildId,
            id: washId,
            userId,
            dirtyAmount,
            cleanAmount,
            remainingDirty,
            totalClean,
            adminId: adminUser?.id ?? '',
            createdAt: stamp.toISO()
          },
          null,
          2
        )
      );

      await refreshStatsMessage({ client, guildId }).catch(() => { });
      await sendGuildLog({
        client,
        guildId,
        title: 'Lavagem registrada',
        user: adminUser,
        accent: 'success',
        fields: [
          { name: '👤 Usuário', value: `<@${userId}>`, inline: true },
          { name: `${EMOJIS.wash} Valor lavado`, value: `$${money(dirtyAmount)}`, inline: true },
          { name: '📊 Percentual', value: `${washPercentage}%`, inline: true },
          { name: '💰 Saldo restante', value: `$${money(remainingDirty)}`, inline: true },
          { name: '💵 Total limpo acumulado', value: `$${money(totalClean)}`, inline: true },
          { name: '👮 Responsável', value: `<@${adminUser?.id ?? ''}>`, inline: true }
        ]
      });
    }
  });

  return { cleanAmount, remainingDirty, totalClean };
}

module.exports = {
  commitWash
};
