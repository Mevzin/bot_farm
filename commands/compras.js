const { ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const { checkAndSetCooldown } = require('../utils/cooldown');
const { isFinanceManager } = require('../utils/permissions');
const { errorEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder().setName('compras').setDescription('Registrar uma compra da facção'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Use este comando dentro de um servidor.' })] });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'compras',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: `Aguarde ${cooldown}s para usar novamente.` })] });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isFinanceManager({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Sem permissão para registrar compras.' })] });
    }

    const modal = new ModalBuilder().setCustomId('finance:purchaseModal').setTitle('Registrar Compra');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('product')
          .setLabel('Produto comprado')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Valor utilizado')
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
    return interaction.showModal(modal);
  }
};
