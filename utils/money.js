const { ensureUserStats, refreshStatsMessage } = require('./stats');
const { sendGuildLog } = require('./audit');
const { DateTime } = require('luxon');
const { getWashPercentage } = require('./financeSettings');

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

function computeSignature({ userId, dirtyAdded }) {
  return JSON.stringify({ userId, dirtyAdded });
}

async function commitDirtyMoney({ client, guildId, user, dirtyAdded, imageUrl }) {
  const dbBefore = client.db.readGuildDb(guildId);
  const washPercentage = getWashPercentage(dbBefore);
  const cleanAdded = Math.floor((dirtyAdded * washPercentage) / 100);
  const signature = computeSignature({ userId: user.id, dirtyAdded });

  let totals = null;
  let createdAt = '';

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
    createdAt = record.createdAt;
  });

  await refreshStatsMessage({ client, guildId }).catch(() => { });

  const stamp = DateTime.fromISO(createdAt || new Date().toISOString());
  const fields = [
    { name: '👤 Usuário', value: `<@${user.id}>`, inline: true },
    { name: '💰 Valor registrado', value: `$${money(dirtyAdded)}`, inline: true },
    { name: '🖼️ Imagem enviada', value: imageUrl ? `[Abrir imagem](${imageUrl})` : 'Não informada', inline: false },
    { name: '📅 Data', value: stamp.toFormat('dd/LL/yyyy'), inline: true },
    { name: '⏰ Hora', value: stamp.toFormat('HH:mm:ss'), inline: true }
  ];

  await sendGuildLog({
    client,
    guildId,
    title: 'Dinheiro sujo registrado',
    user,
    fields,
    imageUrl: imageUrl || undefined,
    channelId: dbBefore?.config?.financeChannelId || dbBefore?.config?.farmLogChannelId || dbBefore?.config?.logChannelId,
    includeStamp: false
  });

  return { cleanAdded, totals, washPercentage, createdAt };
}

module.exports = {
  commitDirtyMoney,
  getWashPercentage
};
