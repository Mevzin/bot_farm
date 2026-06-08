const { ensureUserStats, refreshStatsMessage } = require('./stats');
const { sendGuildLog } = require('./audit');

async function commitFarm({ client, guildId, user, category, qty }) {
  const signature = JSON.stringify({ userId: user.id, category, qty });

  await client.db.updateGuildDb(guildId, (db) => {
    const recent = (db.farm.records ?? []).slice(-30);
    const dup = recent.find((r) => r.signature === signature && Date.now() - Date.parse(r.createdAt) < 60_000);
    if (dup) {
      const err = new Error('DUPLICATE');
      err.code = 'DUPLICATE';
      throw err;
    }

    if (!db.farm.byUserId[user.id]) db.farm.byUserId[user.id] = {};
    db.farm.byUserId[user.id][category] = Number(db.farm.byUserId[user.id][category] ?? 0) + qty;
    db.farm.records.push({
      id: `farm_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
      userId: user.id,
      category,
      qty,
      signature,
      createdAt: new Date().toISOString()
    });

    const st = ensureUserStats(db, user.id);
    st.farmTotal += qty;
  });

  await refreshStatsMessage({ client, guildId }).catch(() => {});

  await sendGuildLog({
    client,
    guildId,
    title: 'Farm registrado',
    user,
    fields: [
      { name: 'Categoria', value: category, inline: true },
      { name: 'Quantidade', value: `**${qty.toLocaleString('pt-BR')}**`, inline: true }
    ]
  });
}

module.exports = { commitFarm };

