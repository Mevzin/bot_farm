const { DateTime } = require('luxon');

const { parsePositiveInt } = require('../utils/validate');
const { isFinanceManager } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');
const { sendGuildLog } = require('../utils/audit');
const { ensureUserStats, refreshStatsMessage } = require('../utils/stats');
const { getSalePercentage } = require('../utils/financeSettings');

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

module.exports = {
  customIdPrefix: 'finance',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    if (!interaction.isModalSubmit()) return;

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isFinanceManager({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Sem permissão para usar este comando.' })] });
    }

    if (interaction.customId === 'finance:purchaseModal') {
      await interaction.deferReply({ ephemeral: true });

      const product = interaction.fields.getTextInputValue('product').trim();
      const amount = parsePositiveInt(interaction.fields.getTextInputValue('amount'));
      const notes = interaction.fields.getTextInputValue('notes').trim();
      if (!product || !amount) {
        await interaction.editReply({ embeds: [errorEmbed({ description: 'Preencha produto e valor corretamente.' })] });
        return;
      }

      const stamp = DateTime.local();
      let factionBalance = 0;

      try {
        await client.tx.runTransaction({
          guildId: interaction.guildId,
          key: `purchase:${interaction.user.id}`,
          ttlMs: 20_000,
          mutate: async (db2) => {
            const currentBalance = Number(db2.config.factionBalance ?? 0);
            if (amount > currentBalance) {
              const err = new Error('INSUFFICIENT_FACTION_BALANCE');
              err.code = 'INSUFFICIENT_FACTION_BALANCE';
              throw err;
            }

            db2.config.factionBalance = currentBalance - amount;
            factionBalance = db2.config.factionBalance;
            if (!db2.purchases.records) db2.purchases.records = [];
            db2.purchases.records.push({
              id: `purchase_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
              product,
              amount,
              notes,
              userId: interaction.user.id,
              createdAt: stamp.toISO()
            });
          }
        });
      } catch (err) {
        const message =
          err?.code === 'INSUFFICIENT_FACTION_BALANCE'
            ? 'O caixa da facção não possui saldo suficiente para esta compra.'
            : 'Falha ao registrar compra.';
        await interaction.editReply({ embeds: [errorEmbed({ description: message })] });
        return;
      }

      await sendGuildLog({
        client,
        guildId: interaction.guildId,
        channelId: db?.config?.purchaseLogChannelId || db?.config?.logChannelId,
        title: 'Compra registrada',
        user: interaction.user,
        accent: 'danger',
        includeStamp: false,
        fields: [
          { name: '🛒 Produto', value: product, inline: true },
          { name: '💸 Valor gasto', value: `$${money(amount)}`, inline: true },
          { name: '👤 Responsável', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📅 Data', value: stamp.toFormat('dd/LL/yyyy'), inline: true },
          { name: '⏰ Hora', value: stamp.toFormat('HH:mm:ss'), inline: true },
          { name: '🏦 Caixa da facção', value: `$${money(factionBalance)}`, inline: true },
          ...(notes ? [{ name: 'Observações', value: notes, inline: false }] : [])
        ]
      });

      await interaction.editReply({
        embeds: [
          successEmbed({
            title: 'Compra registrada',
            fields: [
              { name: 'Produto', value: product, inline: true },
              { name: 'Valor gasto', value: `$${money(amount)}`, inline: true },
              { name: 'Caixa atual', value: `$${money(factionBalance)}`, inline: true }
            ]
          })
        ]
      });
      return;
    }

    if (interaction.customId === 'finance:saleModal') {
      await interaction.deferReply({ ephemeral: true });

      const buyerFaction = interaction.fields.getTextInputValue('buyerFaction').trim();
      const items = interaction.fields.getTextInputValue('items').trim();
      const quantity = interaction.fields.getTextInputValue('quantity').trim();
      const amount = parsePositiveInt(interaction.fields.getTextInputValue('amount'));
      const notes = interaction.fields.getTextInputValue('notes').trim();
      if (!buyerFaction || !items || !quantity || !amount) {
        await interaction.editReply({ embeds: [errorEmbed({ description: 'Preencha todos os campos obrigatórios corretamente.' })] });
        return;
      }

      const stamp = DateTime.local();
      const salePercentage = Math.max(1, Math.min(99, getSalePercentage(db)));
      const sellerAmount = Math.floor((amount * salePercentage) / 100);
      const factionAmount = amount - sellerAmount;
      let factionBalance = 0;
      let sellerDirtyTotal = 0;

      try {
        await client.tx.runTransaction({
          guildId: interaction.guildId,
          key: `sale:${interaction.user.id}`,
          ttlMs: 20_000,
          mutate: async (db2) => {
            db2.config.factionBalance = Number(db2.config.factionBalance ?? 0) + factionAmount;
            factionBalance = db2.config.factionBalance;
            if (!db2.dirtyMoney.byUserId[interaction.user.id]) db2.dirtyMoney.byUserId[interaction.user.id] = { dirtyTotal: 0, cleanTotal: 0 };
            db2.dirtyMoney.byUserId[interaction.user.id].dirtyTotal += sellerAmount;
            sellerDirtyTotal = db2.dirtyMoney.byUserId[interaction.user.id].dirtyTotal;
            const st = ensureUserStats(db2, interaction.user.id);
            st.dirtyMoney += sellerAmount;
            if (!db2.sales.records) db2.sales.records = [];
            db2.sales.records.push({
              id: `sale_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
              buyerFaction,
              sellerId: interaction.user.id,
              items,
              quantity,
              totalAmount: amount,
              sellerAmount,
              factionAmount,
              notes,
              salePercentage,
              createdAt: stamp.toISO()
            });
          }
        });
      } catch {
        await interaction.editReply({ embeds: [errorEmbed({ description: 'Falha ao registrar venda.' })] });
        return;
      }

      await refreshStatsMessage({ client, guildId: interaction.guildId }).catch(() => { });

      await sendGuildLog({
        client,
        guildId: interaction.guildId,
        channelId: db?.config?.salesLogChannelId || db?.config?.logChannelId,
        title: 'Venda registrada',
        user: interaction.user,
        accent: 'success',
        includeStamp: false,
        fields: [
          { name: '🏷️ Comprador', value: buyerFaction, inline: true },
          { name: '📦 Itens', value: items, inline: false },
          { name: '🔢 Quantidade', value: quantity, inline: true },
          { name: '💰 Valor total', value: `$${money(amount)}`, inline: true },
          { name: '👤 Comissão do vendedor', value: `$${money(sellerAmount)} (${salePercentage}%)`, inline: true },
          { name: '🏛️ Valor destinado à facção', value: `$${money(factionAmount)}`, inline: true },
          { name: '💼 Saldo do vendedor', value: `$${money(sellerDirtyTotal)}`, inline: true },
          { name: '📅 Data', value: stamp.toFormat('dd/LL/yyyy'), inline: true },
          { name: '⏰ Hora', value: stamp.toFormat('HH:mm:ss'), inline: true },
          ...(notes ? [{ name: 'Observações', value: notes, inline: false }] : [])
        ]
      });

      await interaction.editReply({
        embeds: [
          successEmbed({
            title: 'Venda registrada',
            fields: [
              { name: 'Comprador', value: buyerFaction, inline: true },
              { name: 'Valor total', value: `$${money(amount)}`, inline: true },
              { name: 'Comissão vendedor', value: `$${money(sellerAmount)}`, inline: true },
              { name: 'Valor facção', value: `$${money(factionAmount)}`, inline: true },
              { name: 'Saldo vendedor', value: `$${money(sellerDirtyTotal)}`, inline: true },
              { name: 'Caixa atual', value: `$${money(factionBalance)}`, inline: true }
            ]
          })
        ]
      });
    }
  }
};
