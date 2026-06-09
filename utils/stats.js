const fs = require('node:fs');
const path = require('node:path');
const { DateTime } = require('luxon');

const { infoEmbed } = require('./embedBuilder');
const { ensureDir } = require('./fs');
const { getWashPercentage } = require('./financeSettings');

function formatMoney(n) {
  const v = Number(n ?? 0);
  return v.toLocaleString('pt-BR');
}

function ensureUserStats(db, userId) {
  if (!db.stats.byUserId[userId]) {
    db.stats.byUserId[userId] = {
      farmTotal: 0,
      dirtyMoney: 0,
      cleanMoney: 0,
      itemsDeposited: 0,
      itemsWithdrawn: 0
    };
  }
  return db.stats.byUserId[userId];
}

function renderStatsEmbed(db) {
  const totals = db?.dirtyMoney?.byUserId ?? {};
  const washPercentage = getWashPercentage(db);
  const entries = Object.entries(totals).map(([userId, v]) => ({
    userId,
    dirty: Number(v?.dirtyTotal ?? 0),
    clean: Math.floor((Number(v?.dirtyTotal ?? 0) * washPercentage) / 100)
  }));

  entries.sort((a, b) => b.dirty - a.dirty);
  const top = entries.slice(0, 15);

  const medal = (pos) => (pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`);

  const lines = top.map((e, idx) => {
    const pos = idx + 1;
    return (
      `${medal(pos)} <@${e.userId}>\n` +
      `💰 $${formatMoney(e.dirty)}\n` +
      `💵 $${formatMoney(e.clean)}`
    );
  });

  return infoEmbed({
    title: 'RANKING DINHEIRO SUJO',
    description: lines.join('\n\n') || 'Sem dados ainda.'
  });
}

async function refreshStatsMessage({ client, guildId }) {
  const db = client.db.readGuildDb(guildId);
  if (db?.config?.rankingEnabled === false) return;
  const rankingChannelId = db?.config?.rankingChannelId;
  if (!rankingChannelId) return;

  const channel = await client.channels.fetch(rankingChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = renderStatsEmbed(db);
  const currentMessageId = db?.config?.statsMessageId || '';

  let message = null;
  if (currentMessageId) {
    message = await channel.messages.fetch(currentMessageId).catch(() => null);
  }

  if (!message) {
    const sent = await channel.send({ embeds: [embed] });
    await client.db.updateGuildDb(guildId, (db2) => {
      db2.config.statsMessageId = sent.id;
    });
    return;
  }

  await message.edit({ embeds: [embed] });
}

async function weeklyResetRanking({ client, baseDir, guildId }) {
  const db = client.db.readGuildDb(guildId);
  if (!db?.config?.weeklyResetEnabled) return;

  const now = DateTime.local();
  if (now.weekday !== 7) return;

  const last = db.config.lastWeeklyResetAt ? DateTime.fromISO(db.config.lastWeeklyResetAt) : null;
  const alreadyThisWeek = last && last.hasSame(now, 'week');
  if (alreadyThisWeek) return;

  const snapshot = {
    guildId,
    createdAt: now.toISO(),
    ranking: Object.entries(db?.dirtyMoney?.byUserId ?? {})
      .map(([userId, v]) => ({
        userId,
        dirtyTotal: Number(v?.dirtyTotal ?? 0),
        cleanTotal: Number(v?.cleanTotal ?? 0)
      }))
      .sort((a, b) => b.dirtyTotal - a.dirtyTotal)
  };

  const outDir = path.join(baseDir, 'database', 'history', now.toFormat('yyyy-LL-dd'));
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, `ranking_${guildId}.json`), JSON.stringify(snapshot, null, 2));

  await client.db.updateGuildDb(guildId, (db2) => {
    for (const userId of Object.keys(db2.dirtyMoney.byUserId ?? {})) {
      db2.dirtyMoney.byUserId[userId].dirtyTotal = 0;
      db2.dirtyMoney.byUserId[userId].cleanTotal = 0;
    }
    db2.config.lastWeeklyResetAt = now.toISO();
  });

  await refreshStatsMessage({ client, guildId }).catch(() => { });
}

module.exports = {
  ensureUserStats,
  refreshStatsMessage,
  weeklyResetRanking
};
