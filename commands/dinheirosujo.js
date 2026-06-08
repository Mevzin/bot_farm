const { ActionRowBuilder, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const { checkAndSetCooldown } = require('../utils/cooldown');

module.exports = {
  data: new SlashCommandBuilder().setName('dinheirosujo').setDescription('Registrar dinheiro sujo (print obrigatória)'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, content: 'Use este comando dentro de um servidor.' });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'dinheirosujo',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, content: `Aguarde ${cooldown}s para usar novamente.` });
    }

    const modal = new ModalBuilder().setCustomId('dm:modal').setTitle('Registrar Dinheiro Sujo');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel('Valor do dinheiro sujo')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Ex: 1000000')
      )
    );

    return interaction.showModal(modal);
  }
};

