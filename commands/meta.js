const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} = require('discord.js');

const { isMemberAdmin } = require('../utils/permissions');
const { infoEmbed } = require('../utils/embedBuilder');
const { checkAndSetCooldown } = require('../utils/cooldown');

function renderMetaEmbed(db) {
  const goal = db.goal;
  return infoEmbed({
    title: 'META - Painel',
    fields: [
      { name: 'Canal da Meta', value: db.config.goalChannelId ? `<#${db.config.goalChannelId}>` : 'Não configurado', inline: true },
      { name: 'Campanha', value: goal.campaignName ? `**${goal.campaignName}**` : 'Não configurada', inline: true },
      { name: 'Meta', value: `$${Number(goal.target ?? 0).toLocaleString('pt-BR')}`, inline: true },
      { name: 'Arrecadado', value: `$${Number(goal.current ?? 0).toLocaleString('pt-BR')}`, inline: true }
    ]
  });
}

module.exports = {
  data: new SlashCommandBuilder().setName('meta').setDescription('Configurar e gerenciar meta de doação'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, content: 'Use este comando dentro de um servidor.' });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'meta',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, content: `Aguarde ${cooldown}s para usar novamente.` });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Somente Admin/Master pode configurar metas.' });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('meta:channel').setLabel('Canal da Meta').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('meta:config').setLabel('Configurar Campanha').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('meta:refresh').setLabel('Atualizar Mensagem').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('meta:clear').setLabel('Zerar Meta').setStyle(ButtonStyle.Danger)
    );

    return safeReply(interaction, { ephemeral: true, embeds: [renderMetaEmbed(db)], components: [row] });
  },
  renderMetaEmbed
};

