const fs = require('node:fs');
const path = require('node:path');
const { DateTime } = require('luxon');

const { infoEmbed, successEmbed } = require('./embedBuilder');
const { ensureDir } = require('./fs');
const { EMOJIS } = require('./constants');

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function progressBar({ current, target, size }) {
  const t = Math.max(1, Number(target ?? 0));
  const c = Math.max(0, Number(current ?? 0));
  const pct = clamp(c / t, 0, 1);
  const filled = Math.round(pct * size);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, size - filled))} ${Math.round(pct * 100)}%`;
}

function formatMoney(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

function renderGoalEmbed(goal) {
  const target = Number(goal?.target ?? 0);
  const current = Number(goal?.current ?? 0);
  const missing = Math.max(0, target - current);

  return infoEmbed({
    title: 'META DA FACÇÃO',
    fields: [
      { name: 'Campanha', value: goal?.campaignName ? `**${goal.campaignName}**` : 'Não configurada', inline: false },
      { name: 'Arrecadado', value: `${EMOJIS.moneyDirty} $${formatMoney(current)}`, inline: true },
      { name: 'Meta', value: `${EMOJIS.moneyDirty} $${formatMoney(target)}`, inline: true },
      { name: 'Falta', value: `${EMOJIS.moneyDirty} $${formatMoney(missing)}`, inline: true },
      { name: 'Progresso', value: progressBar({ current, target: Math.max(1, target), size: 10 }), inline: false }
    ]
  });
}

async function ensureGoalMessage({ client, guildId }) {
  const db = client.db.readGuildDb(guildId);
  const channelId = db?.config?.goalChannelId || '';
  if (!channelId) return null;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return null;

  const goalMessageId = db?.goal?.goalMessageId || '';
  const embed = renderGoalEmbed(db.goal);

  let message = null;
  if (goalMessageId) {
    message = await channel.messages.fetch(goalMessageId).catch(() => null);
  }

  if (!message) {
    const sent = await channel.send({ embeds: [embed] });
    await client.db.updateGuildDb(guildId, (db2) => {
      db2.goal.goalMessageId = sent.id;
    });
    return sent;
  }

  await message.edit({ embeds: [embed] });
  return message;
}

async function snapshotGoalIfDone({ client, baseDir, guildId }) {
  const db = client.db.readGuildDb(guildId);
  const goal = db.goal;
  const target = Number(goal?.target ?? 0);
  const current = Number(goal?.current ?? 0);
  if (!target || current < target) return;

  const dt = DateTime.local();
  const outDir = path.join(baseDir, 'database', 'history', dt.toFormat('yyyy-LL-dd'));
  ensureDir(outDir);
  const payload = {
    guildId,
    createdAt: dt.toISO(),
    goal: { ...goal }
  };
  fs.writeFileSync(path.join(outDir, `goal_${guildId}.json`), JSON.stringify(payload, null, 2));

  await client.db.updateGuildDb(guildId, (db2) => {
    db2.goal.campaignName = '';
    db2.goal.target = 0;
    db2.goal.current = 0;
    db2.goal.contributionsByUserId = {};
    db2.goal.contributions = [];
  });

  await ensureGoalMessage({ client, guildId }).catch(() => {});

  return successEmbed({ title: 'Meta concluída', description: 'A meta foi concluída e registrada no histórico.' });
}

module.exports = {
  renderGoalEmbed,
  ensureGoalMessage,
  snapshotGoalIfDone
};
