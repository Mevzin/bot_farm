const { ensureUserStats, refreshStatsMessage } = require('./stats');
const { sendGuildLog } = require('./audit');

function computeSignature({ userId, dirtyAdded }) {
  return JSON.stringify({ userId, dirtyAdded });
}

async function commitDirtyMoney({ client, guildId, user, dirtyAdded, imageUrl }) {
  const cleanAdded = Math.floor(dirtyAdded * 0.75);
  const signature = computeSignature({ userId: user.id, dirtyAdded });

  let totals = null;

  await client.db.updateGuildDb(guildId, (db) => {
    const recent = (db.dirtyMoney?.records ?? []).slice(-30);
    const dup = recent.find((r) => r.signature === signature && Date.now() - Date.parse(r.createdAt) < 60_000);
    if (dup) {
      const err = new Error('DUPLICATE');
      err.code = 'DUPLICATE';
      throw err;
    }

    if (!db.dirtyMoney.records) db.dirtyMoney.records = [];
    if (!db.dirtyMoney.byUserId[user.id]) db.dirtyMoney.byUserId[user.id] = { dirtyTotal: 0, cleanTotal: 0 };

    db.dirtyMoney.byUserId[user.id].dirtyTotal += dirtyAdded;

    const st = ensureUserStats(db, user.id);
    st.dirtyMoney += dirtyAdded;

    const record = {
      id: `dm_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
      userId: user.id,
      dirtyAdded,
      cleanAdded,
      imageUrl: imageUrl || '',
      signature,
      createdAt: new Date().toISOString()
    };
    db.dirtyMoney.records.push(record);
    totals = { ...db.dirtyMoney.byUserId[user.id] };
  });

  await refreshStatsMessage({ client, guildId }).catch(() => {});

  await sendGuildLog({
    client,
    guildId,
    title: 'Dinheiro sujo registrado',
    user,
    fields: [
      { name: 'Valor adicionado (sujo)', value: `**${dirtyAdded.toLocaleString('pt-BR')}**`, inline: true },
      { name: 'Valor após lavagem (limpo)', value: `**${Math.floor(dirtyAdded * 0.75).toLocaleString('pt-BR')}**`, inline: true },
      { name: 'Total (sujo)', value: `**${totals.dirtyTotal.toLocaleString('pt-BR')}**`, inline: true },
      { name: 'Total (limpo)', value: `**${totals.cleanTotal.toLocaleString('pt-BR')}**`, inline: true }
    ],
    imageUrl: imageUrl || undefined
  });

  const cfg = client.db.readGuildDb(guildId)?.config ?? {};
  if (cfg.farmLogChannelId && cfg.farmLogChannelId !== cfg.logChannelId) {
    await sendGuildLog({
      client,
      guildId,
      channelId: cfg.farmLogChannelId,
      title: 'Log Farm - Dinheiro sujo registrado',
      user,
      fields: [
        { name: 'Valor adicionado (sujo)', value: `**${dirtyAdded.toLocaleString('pt-BR')}**`, inline: true },
        { name: 'Valor após lavagem (limpo)', value: `**${Math.floor(dirtyAdded * 0.75).toLocaleString('pt-BR')}**`, inline: true },
        { name: 'Total (sujo)', value: `**${totals.dirtyTotal.toLocaleString('pt-BR')}**`, inline: true },
        { name: 'Total (limpo)', value: `**${totals.cleanTotal.toLocaleString('pt-BR')}**`, inline: true }
      ],
      imageUrl: imageUrl || undefined
    });
  }

  return { cleanAdded, totals };
}

module.exports = {
  commitDirtyMoney
};
