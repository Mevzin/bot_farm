const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} = require('discord.js');

const { buildPanelEmbed } = require('../utils/embeds');
const { isMemberAdmin } = require('../utils/permissions');
const { checkAndSetCooldown } = require('../utils/cooldown');

function renderConfigEmbed(db) {
  const c = db.config;
  return buildPanelEmbed({
    title: 'Painel de Configuração',
    description: 'Configure canais e cargos administrativos do sistema.',
    fields: [
      { name: 'Canal de Logs', value: c.logChannelId ? `<#${c.logChannelId}>` : 'Não configurado', inline: true },
      { name: 'Canal de Registro', value: c.registryChannelId ? `<#${c.registryChannelId}>` : 'Não configurado', inline: true },
      { name: 'Canal de Ranking', value: c.rankingChannelId ? `<#${c.rankingChannelId}>` : 'Não configurado', inline: true },
      { name: 'Canal da Meta', value: c.goalChannelId ? `<#${c.goalChannelId}>` : 'Não configurado', inline: true },
      { name: 'Reset Semanal (Domingo)', value: c.weeklyResetEnabled ? 'Ativo' : 'Desativado', inline: true },
      { name: 'DM Automática', value: c.dmEnabled ? 'Ativa' : 'Desativada', inline: true },
      { name: 'Logs no Canal', value: c.logsEnabled ? 'Ativo' : 'Desativado', inline: true },
      { name: 'Cargo Membro', value: c.memberRoleId ? `<@&${c.memberRoleId}>` : 'Não configurado', inline: true },
      { name: 'Cargo Aprovador', value: c.approverRoleId ? `<@&${c.approverRoleId}>` : 'Não configurado', inline: true },
      { name: 'Cargo Master', value: c.adminRoleIds.master ? `<@&${c.adminRoleIds.master}>` : 'Não configurado', inline: true },
      { name: 'Cargo Admin', value: c.adminRoleIds.admin ? `<@&${c.adminRoleIds.admin}>` : 'Não configurado', inline: true }
    ]
  });
}

module.exports = {
  data: new SlashCommandBuilder().setName('configurar').setDescription('Abrir painel de configuração do bot'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, content: 'Use este comando dentro de um servidor.' });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'configurar',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, content: `Aguarde ${cooldown}s para usar novamente.` });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Você não tem permissão para configurar o bot.' });
    }

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:logs').setLabel('Canal de Logs').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cfg:registry').setLabel('Canal de Registro').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cfg:ranking').setLabel('Canal de Ranking').setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:goal').setLabel('Canal da Meta').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cfg:weekly').setLabel('Reset Semanal').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg:roles').setLabel('Cargos Admin').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg:close').setLabel('Fechar').setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:access').setLabel('Cargos Acesso').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg:dm').setLabel('DM Auto').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg:logsToggle').setLabel('Logs').setStyle(ButtonStyle.Secondary)
    );

    return safeReply(interaction, {
      ephemeral: true,
      embeds: [renderConfigEmbed(db)],
      components: [row1, row2, row3]
    });
  },
  renderConfigEmbed
};
