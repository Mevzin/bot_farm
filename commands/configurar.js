const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} = require('discord.js');

const { buildPanelEmbed } = require('../utils/embeds');
const { isMemberMaster } = require('../utils/permissions');
const { checkAndSetCooldown } = require('../utils/cooldown');

function renderConfigRows(db) {
  const c = db?.config ?? {};
  const weeklyStyle = c.weeklyResetEnabled ? ButtonStyle.Success : ButtonStyle.Danger;
  const dmStyle = c.dmEnabled ? ButtonStyle.Success : ButtonStyle.Danger;
  const logsStyle = c.logsEnabled ? ButtonStyle.Success : ButtonStyle.Danger;
  const registrationStyle = c.registrationEnabled ? ButtonStyle.Success : ButtonStyle.Danger;

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:channel:logs').setLabel('Canal de Logs').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cfg:channel:farmlog').setLabel('Log Farm').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cfg:channel:proof').setLabel('Canal Prints').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cfg:channel:registration').setLabel('Canal Cadastro').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('cfg:channel:ranking').setLabel('Canal Ranking').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:channel:goal').setLabel('Canal Meta').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:role:master').setLabel('Cargo Master').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg:role:admin').setLabel('Cargo Admin').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg:role:member').setLabel('Cargo Membro').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg:role:approver').setLabel('Cargo Aprovador').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:toggle:weekly').setLabel('Reset Semanal').setStyle(weeklyStyle),
      new ButtonBuilder().setCustomId('cfg:toggle:dm').setLabel('DM Automática').setStyle(dmStyle),
      new ButtonBuilder().setCustomId('cfg:toggle:logs').setLabel('Logs no Canal').setStyle(logsStyle),
      new ButtonBuilder().setCustomId('cfg:toggle:registration').setLabel('Registro').setStyle(registrationStyle)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:close').setLabel('Fechar').setStyle(ButtonStyle.Danger)
    )
  ];
}

function renderConfigEmbed(db) {
  const c = db.config;
  return buildPanelEmbed({
    title: 'Painel de Configuração',
    description: 'Configure canais e cargos administrativos do sistema.',
    fields: [
      { name: 'Canal de Logs', value: c.logChannelId ? `<#${c.logChannelId}>` : 'Não configurado', inline: true },
      { name: 'Log Farm', value: c.farmLogChannelId ? `<#${c.farmLogChannelId}>` : 'Não configurado', inline: true },
      { name: 'Canal de Prints', value: c.proofChannelId ? `<#${c.proofChannelId}>` : 'Não configurado', inline: true },
      { name: 'Canal de Cadastro', value: c.registrationChannelId ? `<#${c.registrationChannelId}>` : 'Não configurado', inline: true },
      { name: 'Canal de Ranking', value: c.rankingChannelId ? `<#${c.rankingChannelId}>` : 'Não configurado', inline: true },
      { name: 'Canal da Meta', value: c.goalChannelId ? `<#${c.goalChannelId}>` : 'Não configurado', inline: true },
      { name: 'Cargo Master', value: c.adminRoleIds.master ? `<@&${c.adminRoleIds.master}>` : 'Não configurado', inline: true },
      { name: 'Cargo Admin', value: c.adminRoleIds.admin ? `<@&${c.adminRoleIds.admin}>` : 'Não configurado', inline: true },
      { name: 'Cargo Membro', value: c.memberRoleId ? `<@&${c.memberRoleId}>` : 'Não configurado', inline: true },
      { name: 'Cargo Aprovador', value: c.approverRoleId ? `<@&${c.approverRoleId}>` : 'Não configurado', inline: true },
      { name: 'Sistema de Registro', value: c.registrationEnabled ? 'Ativo' : 'Desativado', inline: true },
      { name: 'Reset Semanal (Domingo)', value: c.weeklyResetEnabled ? 'Ativo' : 'Desativado', inline: true },
      { name: 'DM Automática', value: c.dmEnabled ? 'Ativa' : 'Desativada', inline: true },
      { name: 'Logs no Canal', value: c.logsEnabled ? 'Ativo' : 'Desativado', inline: true }
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
    if (!isMemberMaster({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Somente o cargo Master pode configurar o bot.' });
    }

    return safeReply(interaction, {
      ephemeral: true,
      embeds: [renderConfigEmbed(db)],
      components: renderConfigRows(db)
    });
  },
  renderConfigEmbed,
  renderConfigRows
};
