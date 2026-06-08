const { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder } = require('discord.js');

const { buildPanelEmbed } = require('../utils/embeds');
const { checkAndSetCooldown } = require('../utils/cooldown');

const CATEGORIES = ['Drogas', 'Armas', 'Munições', 'Materiais', 'Outros'];

module.exports = {
  data: new SlashCommandBuilder().setName('farm').setDescription('Registrar farm'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, content: 'Use este comando dentro de um servidor.' });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'farm',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, content: `Aguarde ${cooldown}s para usar novamente.` });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('farm:select')
      .setPlaceholder('Selecione a categoria')
      .addOptions(CATEGORIES.map((c) => ({ label: c, value: c })));

    return safeReply(interaction, {
      ephemeral: true,
      embeds: [buildPanelEmbed({ title: 'Registro de Farm', description: 'Selecione a categoria para registrar.' })],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }
};

