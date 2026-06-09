const { ensureUserStats, refreshStatsMessage } = require('./stats');
const { sendGuildLog } = require('./audit');
const { EmbedBuilder } = require('discord.js');

function computeSignature({ mode, userId, items }) {
  const sorted = [...items].sort((a, b) => a.itemId.localeCompare(b.itemId));
  return JSON.stringify({ mode, userId, items: sorted });
}

function findItem(db, itemId) {
  return (db.items ?? []).find((x) => x.id === itemId) ?? null;
}

async function commitChestMovement({ client, guildId, mode, user, items, imageUrl }) {
  const nowIso = new Date().toISOString();
  const signature = computeSignature({ mode, userId: user.id, items });
  let movementId = '';
  let movement = null;

  await client.db.updateGuildDb(guildId, (db) => {
    const recent = (db.chest.movements ?? []).slice(-30);
    const dup = recent.find((m) => m.signature === signature && Date.now() - Date.parse(m.createdAt) < 60_000);
    if (dup) {
      const err = new Error('DUPLICATE');
      err.code = 'DUPLICATE';
      throw err;
    }

    const stock = db.chest.stockByItemId;
    for (const it of items) {
      const current = Number(stock[it.itemId] ?? 0);
      if (mode === 'withdraw' && current < it.qty) {
        const err = new Error('INSUFFICIENT_STOCK');
        err.code = 'INSUFFICIENT_STOCK';
        err.meta = { itemId: it.itemId, current, requested: it.qty };
        throw err;
      }
    }

    for (const it of items) {
      const current = Number(stock[it.itemId] ?? 0);
      stock[it.itemId] = mode === 'deposit' ? current + it.qty : current - it.qty;
    }

    movementId = `mov_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
    movement = {
      id: movementId,
      type: mode,
      userId: user.id,
      items,
      imageUrl: imageUrl || '',
      signature,
      createdAt: nowIso
    };
    db.chest.movements.push(movement);

    const st = ensureUserStats(db, user.id);
    const totalQty = items.reduce((acc, x) => acc + x.qty, 0);
    if (mode === 'deposit') st.itemsDeposited += totalQty;
    if (mode === 'withdraw') st.itemsWithdrawn += totalQty;
  });

  await refreshStatsMessage({ client, guildId }).catch(() => {});

  const dbAfter = client.db.readGuildDb(guildId);
  const fields = items.map((it) => {
    const item = findItem(dbAfter, it.itemId);
    const available = Number(dbAfter.chest.stockByItemId[it.itemId] ?? 0);
    return {
      name: item?.name ?? it.itemId,
      value: `Qtd: **${it.qty}** | Estoque: **${available}**`,
      inline: false
    };
  });

  await sendGuildLog({
    client,
    guildId,
    title: mode === 'deposit' ? 'Guardou item no baú' : 'Retirou item do baú',
    user,
    fields,
    imageUrl: imageUrl || undefined
  });

  if (mode === 'deposit') {
    try {
      const chestChannelId = dbAfter?.config?.chestChannelId || dbAfter?.config?.registryChannelId || '';
      if (chestChannelId) {
        const channel = await client.channels.fetch(chestChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle('Depósito no Baú')
            .setColor(0x3498db)
            .setDescription(`Por: <@${user.id}>`)
            .addFields(fields)
            .setTimestamp(new Date());
          if (imageUrl) embed.setImage(imageUrl);
          await channel.send({ embeds: [embed] });
        }
      }
    } catch (err) {
      client.logger.warn('chest.channel.failed', { guildId, message: err?.message });
    }
  }

  return { movementId };
}

module.exports = {
  commitChestMovement
};
