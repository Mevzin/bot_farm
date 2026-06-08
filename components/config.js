const {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { isMemberAdmin } = require('../utils/permissions');
const { sendGuildLog } = require('../utils/audit');
const { refreshStatsMessage } = require('../utils/stats');
const { renderConfigEmbed } = require('../commands/configurar');

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cfg:back').setLabel('Voltar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg:close').setLabel('Fechar').setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  customIdPrefix: 'cfg',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Sem permissão.' });
    }

    const [prefix, action, extra] = String(interaction.customId).split(':');

    if (interaction.isButton()) {
      if (action === 'close') {
        return interaction.update({ content: 'Painel fechado.', embeds: [], components: [] });
      }
      if (action === 'back') {
        const cfgCmd = client.commands.get('configurar');
        const db2 = client.db.readGuildDb(interaction.guildId);
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg:logs').setLabel('Canal de Logs').setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('cfg:registry')
            .setLabel('Canal de Registro')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('cfg:ranking')
            .setLabel('Canal de Ranking')
            .setStyle(ButtonStyle.Primary)
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
        return interaction.update({ embeds: [cfgCmd.renderConfigEmbed(db2)], components: [row1, row2, row3], content: '' });
      }

      if (action === 'logs' || action === 'registry' || action === 'ranking' || action === 'goal') {
        const key =
          action === 'logs'
            ? 'logChannelId'
            : action === 'registry'
              ? 'registryChannelId'
              : action === 'ranking'
                ? 'rankingChannelId'
                : 'goalChannelId';
        const select = new ChannelSelectMenuBuilder()
          .setCustomId(`cfg:set:${key}`)
          .setPlaceholder('Selecione um canal')
          .addChannelTypes(ChannelType.GuildText);

        return interaction.update({
          embeds: [
            renderConfigEmbed(db).setDescription(
              `Selecione o canal para **${action === 'logs'
                ? 'Logs'
                : action === 'registry'
                  ? 'Registro'
                  : action === 'ranking'
                    ? 'Ranking'
                    : 'Meta'
              }**.`
            )
          ],
          components: [new ActionRowBuilder().addComponents(select), backRow()],
          content: ''
        });
      }

      if (action === 'roles') {
        const select = new RoleSelectMenuBuilder().setCustomId('cfg:set:roles').setPlaceholder('Selecione 1 ou 2 cargos');
        return interaction.update({
          embeds: [renderConfigEmbed(db).setDescription('Selecione os cargos administrativos (Master e Admin).')],
          components: [new ActionRowBuilder().addComponents(select), backRow()],
          content: ''
        });
      }

      if (action === 'access') {
        const select = new RoleSelectMenuBuilder().setCustomId('cfg:set:access').setPlaceholder('Selecione 1 ou 2 cargos');
        return interaction.update({
          embeds: [renderConfigEmbed(db).setDescription('Selecione cargos: Membro e Aprovador (opcional).')],
          components: [new ActionRowBuilder().addComponents(select), backRow()],
          content: ''
        });
      }

      if (action === 'weekly') {
        await interaction.deferUpdate();
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.config.weeklyResetEnabled = !db2.config.weeklyResetEnabled;
        });
        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Reset semanal atualizado',
          user: interaction.user,
          accent: 'warning',
          fields: [
            {
              name: 'Status',
              value: client.db.readGuildDb(interaction.guildId).config.weeklyResetEnabled ? 'Ativo' : 'Desativado',
              inline: true
            }
          ]
        });
        const db3 = client.db.readGuildDb(interaction.guildId);
        await interaction.message.edit({ embeds: [renderConfigEmbed(db3)], components: interaction.message.components, content: 'Salvo.' });
        return;
      }

      if (action === 'dm') {
        await interaction.deferUpdate();
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.config.dmEnabled = !db2.config.dmEnabled;
        });
        const enabled = client.db.readGuildDb(interaction.guildId).config.dmEnabled;
        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'DM automática atualizada',
          user: interaction.user,
          accent: 'warning',
          fields: [{ name: 'Status', value: enabled ? 'Ativa' : 'Desativada', inline: true }]
        });
        const db3 = client.db.readGuildDb(interaction.guildId);
        await interaction.message.edit({ embeds: [renderConfigEmbed(db3)], components: interaction.message.components, content: 'Salvo.' });
        return;
      }

      if (action === 'logsToggle') {
        await interaction.deferUpdate();
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.config.logsEnabled = !db2.config.logsEnabled;
        });
        const enabled = client.db.readGuildDb(interaction.guildId).config.logsEnabled;
        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Logs no canal atualizados',
          user: interaction.user,
          accent: 'warning',
          fields: [{ name: 'Status', value: enabled ? 'Ativo' : 'Desativado', inline: true }]
        });
        const db3 = client.db.readGuildDb(interaction.guildId);
        await interaction.message.edit({ embeds: [renderConfigEmbed(db3)], components: interaction.message.components, content: 'Salvo.' });
        return;
      }
    }

    if (interaction.isChannelSelectMenu()) {
      if (action !== 'set') return;
      await interaction.deferUpdate();
      const key = extra;
      const selected = interaction.values?.[0] ?? '';
      await client.db.updateGuildDb(interaction.guildId, (db2) => {
        db2.config[key] = selected;
      });

      await sendGuildLog({
        client,
        guildId: interaction.guildId,
        title: 'Configuração atualizada',
        user: interaction.user,
        fields: [
          { name: 'Campo', value: key, inline: true },
          { name: 'Canal', value: selected ? `<#${selected}>` : 'Nenhum', inline: true }
        ]
      });

      if (key === 'rankingChannelId') {
        await refreshStatsMessage({ client, guildId: interaction.guildId }).catch(() => { });
      }
      if (key === 'goalChannelId') {
        const { ensureGoalMessage } = require('../utils/goal');
        await ensureGoalMessage({ client, guildId: interaction.guildId }).catch(() => { });
      }

      const db3 = client.db.readGuildDb(interaction.guildId);
      await interaction.message.edit({
        embeds: [renderConfigEmbed(db3)],
        components: interaction.message.components,
        content: 'Salvo.'
      });
      return;
    }

    if (interaction.isRoleSelectMenu()) {
      if (action !== 'set') return;
      await interaction.deferUpdate();
      const selected = interaction.values ?? [];

      if (extra === 'roles') {
        const master = selected[0] ?? '';
        const admin = selected[1] ?? selected[0] ?? '';

        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.config.adminRoleIds.master = master;
          db2.config.adminRoleIds.admin = admin;
        });

        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Cargos administrativos atualizados',
          user: interaction.user,
          fields: [
            { name: 'Master', value: master ? `<@&${master}>` : 'Nenhum', inline: true },
            { name: 'Admin', value: admin ? `<@&${admin}>` : 'Nenhum', inline: true }
          ]
        });
      }

      if (extra === 'access') {
        const memberRoleId = selected[0] ?? '';
        const approverRoleId = selected[1] ?? '';
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.config.memberRoleId = memberRoleId;
          db2.config.approverRoleId = approverRoleId;
        });
        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Cargos de acesso atualizados',
          user: interaction.user,
          accent: 'warning',
          fields: [
            { name: 'Membro', value: memberRoleId ? `<@&${memberRoleId}>` : 'Nenhum', inline: true },
            { name: 'Aprovador', value: approverRoleId ? `<@&${approverRoleId}>` : 'Nenhum', inline: true }
          ]
        });
      }

      const db3 = client.db.readGuildDb(interaction.guildId);
      await interaction.message.edit({ embeds: [renderConfigEmbed(db3)], components: interaction.message.components, content: 'Salvo.' });
      return;
    }

    return safeReply(interaction, { ephemeral: true, content: 'Ação não reconhecida.' });
  }
};
