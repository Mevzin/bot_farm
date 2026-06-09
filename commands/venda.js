const { ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const { checkAndSetCooldown } = require('../utils/cooldown');
const { isFinanceManager } = require('../utils/permissions');
const { errorEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('venda').setDescription('Registrar uma venda da facção'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Use este comando dentro de um servidor.' })] });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'venda',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: `Aguarde ${cooldown}s para usar novamente.` })] });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isFinanceManager({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Sem permissão para registrar vendas.' })] });
    }

    const modal = new ModalBuilder().setCustomId('finance:saleModal').setTitle('Registrar Venda');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('buyerFaction')
          .setLabel('Facção compradora')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('items')
          .setLabel('Itens vendidos')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('quantity')
          .setLabel('Quantidade dos itens')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Valor total da venda')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('notes')
          .setLabel('Observações')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
      )
    );
    try {
      return await interaction.showModal(modal);
    } catch (err) {
      client.logger.warn('sale.modal.failed', { guildId: interaction.guildId, message: err?.message, code: err?.code ?? null });
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Falha ao abrir o formulário de venda.' })] });
    }
  }
};
