const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const { parsePositiveInt } = require('../utils/validate');
const { errorEmbed, infoEmbed, successEmbed, warningEmbed } = require('../utils/embedBuilder');
const { ensureGoalMessage, snapshotGoalIfDone } = require('../utils/goal');
const { refreshStatsMessage } = require('../utils/stats');
const { createCustomId, parseCustomId, assertCustomIdOwner } = require('../utils/customId');
const { sendGuildLog } = require('../utils/audit');

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

function buildDonatePromptEmbed({ db, userId, baseAmount = 0 }) {
  const goal = db.goal;
  const totals = db?.dirtyMoney?.byUserId?.[userId] ?? { dirtyTotal: 0, cleanTotal: 0 };
  const target = Number(goal?.target ?? 0);
  const current = Number(goal?.current ?? 0);
  const missing = Math.max(0, target - current);
  const pct = target ? Math.min(100, Math.floor((current / target) * 100)) : 0;
  const recentDeposit = Math.max(0, Number(baseAmount ?? 0));

  return infoEmbed({
    title: 'Deseja contribuir para a facção?',
    description:
      `Depósito atual: **$${money(recentDeposit)}**\n` +
      `Saldo atual: **$${money(totals.dirtyTotal)}**\n` +
      `Meta: **$${money(target)}** | Falta: **$${money(missing)}** | Concluída: **${pct}%**`
  });
}

function buildDonateButtons({ guildId, userId, baseAmount }) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'donate10', guildId, userId, extra: [String(baseAmount)] }))
      .setLabel('Doar 10%')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'donate25', guildId, userId, extra: [String(baseAmount)] }))
      .setLabel('Doar 25%')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'donate50', guildId, userId, extra: [String(baseAmount)] }))
      .setLabel('Doar 50%')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'custom', guildId, userId, extra: [String(baseAmount)] }))
      .setLabel('Personalizado')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildDonateButtonsRow2({ guildId, userId, baseAmount }) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'cancel', guildId, userId, extra: [String(baseAmount)] }))
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Danger)
  );
}

function buildDonationConfirmationEmbed({ amount, baseAmount, dirtyTotal, goalCurrent }) {
  return successEmbed({
    title: 'Doação concluída',
    description: 'Contribuição registrada com sucesso.',
    fields: [
      { name: 'Valor depositado', value: `$${money(baseAmount)}`, inline: true },
      { name: 'Valor doado', value: `$${money(amount)}`, inline: true },
      { name: 'Novo saldo', value: `$${money(dirtyTotal)}`, inline: true },
      { name: 'Meta atual', value: `$${money(goalCurrent)}`, inline: true }
    ]
  });
}

module.exports = {
  customIdPrefix: 'goal',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;

    if (interaction.isButton()) {
      const parsed = parseCustomId(interaction.customId);
      if (!assertCustomIdOwner({ interaction, parsed })) {
        return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Este painel não é seu.' })] });
      }

      const action = parsed.action;
      if (action === 'cancel') {
        await interaction.deferUpdate();
        await interaction.message.edit({ embeds: [infoEmbed({ title: 'Cancelado', description: 'Doação cancelada.' })], components: [] });
        return;
      }

      if (action === 'custom') {
        const baseAmount = Number(parsed.rest?.[0] ?? 0);
        const modalId = createCustomId({
          prefix: 'goal',
          action: 'modal',
          guildId: interaction.guildId,
          userId: interaction.user.id,
          extra: [String(baseAmount), interaction.message.id]
        });
        const modal = new ModalBuilder().setCustomId(modalId).setTitle('Doação Personalizada');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('amount')
              .setLabel('Valor para doar (inteiro)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
        return interaction.showModal(modal);
      }

      const percent = action === 'donate10' ? 10 : action === 'donate25' ? 25 : action === 'donate50' ? 50 : 0;
      if (!percent) return;

      await interaction.deferUpdate();
      const db = client.db.readGuildDb(interaction.guildId);
      const userId = interaction.user.id;
      if (db?.config?.donationEnabled === false || db?.config?.metaEnabled === false) {
        await interaction.message.edit({ embeds: [warningEmbed({ description: 'Sistema de doação indisponível no momento.' })], components: [] });
        return;
      }
      const balance = Number(db?.dirtyMoney?.byUserId?.[userId]?.dirtyTotal ?? 0);
      const baseAmount = Math.max(0, Number(parsed.rest?.[0] ?? 0));
      const amount = Math.floor((baseAmount * percent) / 100);
      if (!amount) {
        await interaction.message.edit({ embeds: [warningEmbed({ description: 'Saldo insuficiente para doar este percentual.' })], components: [] });
        return;
      }
      if (amount > balance) {
        await interaction.message.edit({ embeds: [warningEmbed({ description: 'Seu saldo atual nao cobre essa doação.' })], components: [] });
        return;
      }

      await donate({ client, interaction, amount, baseAmount, sourceMessage: interaction.message });
      return;
    }

    if (interaction.isModalSubmit()) {
      const parsed = parseCustomId(interaction.customId);
      if (!assertCustomIdOwner({ interaction, parsed })) {
        return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Este modal não é seu.' })] });
      }
      if (parsed.action !== 'modal') return;

      await interaction.deferReply({ ephemeral: true });
      const amount = parsePositiveInt(interaction.fields.getTextInputValue('amount'));
      if (!amount) {
        await interaction.editReply({ embeds: [errorEmbed({ description: 'Valor inválido. Use apenas números positivos.' })] });
        return;
      }

      const db = client.db.readGuildDb(interaction.guildId);
      const userId = interaction.user.id;
      if (db?.config?.donationEnabled === false || db?.config?.metaEnabled === false) {
        await interaction.editReply({ embeds: [errorEmbed({ description: 'Sistema de doação indisponível no momento.' })] });
        return;
      }
      const balance = Number(db?.dirtyMoney?.byUserId?.[userId]?.dirtyTotal ?? 0);
      const baseAmount = Math.max(0, Number(parsed.rest?.[0] ?? 0));
      const sourceMessageId = parsed.rest?.[1] ?? '';
      if (amount > baseAmount) {
        await interaction.editReply({ embeds: [errorEmbed({ description: 'A doação personalizada deve usar somente o valor do depósito atual.' })] });
        return;
      }
      if (amount > balance) {
        await interaction.editReply({ embeds: [errorEmbed({ description: 'Você não pode doar mais do que possui.' })] });
        return;
      }

      try {
        let sourceMessage = null;
        if (sourceMessageId && interaction.channel?.isTextBased()) {
          sourceMessage = await interaction.channel.messages.fetch(sourceMessageId).catch(() => null);
        }
        await donate({ client, interaction, amount, baseAmount, modalReply: true, sourceMessage });
        return;
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed({ description: 'Falha ao registrar doação.' })] });
        return;
      }
    }
  }
};

async function donate({ client, interaction, amount, baseAmount = 0, modalReply = false, sourceMessage = null }) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const recentDeposit = Math.max(0, Number(baseAmount ?? 0));

  const baseDir = require('node:path').join(__dirname, '..');
  let dirtyTotalAfter = 0;
  let goalCurrentAfter = 0;

  const afterCommit = async () => {
    await ensureGoalMessage({ client, guildId });
    await refreshStatsMessage({ client, guildId });
    await snapshotGoalIfDone({ client, baseDir, guildId }).catch(() => { });
  };

  await client.tx.runTransaction({
    guildId,
    key: `goalDonate:${userId}`,
    ttlMs: 20_000,
    mutate: async (db2) => {
      const goal = db2.goal;
      const totals = db2?.dirtyMoney?.byUserId?.[userId];
      if (!goal?.target || !goal.campaignName) {
        const err = new Error('GOAL_NOT_CONFIGURED');
        err.code = 'GOAL_NOT_CONFIGURED';
        throw err;
      }
      if (!totals || Number(totals.dirtyTotal ?? 0) < amount) {
        const err = new Error('INSUFFICIENT_FUNDS');
        err.code = 'INSUFFICIENT_FUNDS';
        throw err;
      }

      totals.dirtyTotal -= amount;
      goal.current += amount;
      dirtyTotalAfter = totals.dirtyTotal;
      goalCurrentAfter = goal.current;

      const createdAt = new Date().toISOString();
      if (!goal.contributionsByUserId[userId]) goal.contributionsByUserId[userId] = 0;
      goal.contributionsByUserId[userId] += amount;
      goal.contributions.push({
        id: `don_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`,
        userId,
        amount,
        sourceDeposit: recentDeposit,
        createdAt
      });
    },
    afterCommit
  });

  await sendGuildLog({
    client,
    guildId,
    title: 'Doação registrada',
    user: interaction.user,
    accent: 'success',
    fields: [
      { name: 'Depósito atual', value: `$${money(recentDeposit)}`, inline: true },
      { name: 'Valor doado', value: `$${amount.toLocaleString('pt-BR')}`, inline: true },
      { name: 'Novo saldo', value: `$${money(dirtyTotalAfter)}`, inline: true },
      { name: 'Meta atual', value: `$${money(goalCurrentAfter)}`, inline: true }
    ]
  });

  const confirmationEmbed = buildDonationConfirmationEmbed({
    amount,
    baseAmount: recentDeposit,
    dirtyTotal: dirtyTotalAfter,
    goalCurrent: goalCurrentAfter
  });

  if (modalReply) {
    if (sourceMessage) {
      await sourceMessage.edit({ embeds: [confirmationEmbed], components: [] }).catch(() => { });
    }
    await interaction.editReply({
      embeds: [
        successEmbed({
          title: 'Doação concluída',
          description:
            `Valor depositado: **$${money(recentDeposit)}**\n` +
            `Valor doado: **$${money(amount)}**\n` +
            `Novo saldo: **$${money(dirtyTotalAfter)}**\n` +
            `Meta atual: **$${money(goalCurrentAfter)}**`
        })
      ]
    });
    return;
  }

  await interaction.message.edit({ embeds: [confirmationEmbed], components: [] });
}

module.exports.buildDonatePromptEmbed = buildDonatePromptEmbed;
module.exports.buildDonateButtons = buildDonateButtons;
module.exports.buildDonateButtonsRow2 = buildDonateButtonsRow2;
