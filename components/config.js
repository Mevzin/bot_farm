const {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { isMemberMaster } = require('../utils/permissions');
const { sendGuildLog } = require('../utils/audit');
const { refreshStatsMessage } = require('../utils/stats');
const { ensureGoalMessage } = require('../utils/goal');
const { renderConfigEmbed, renderConfigRows } = require('../commands/configurar');
const { errorEmbed } = require('../utils/embedBuilder');

const CHANNEL_FIELD_BY_ACTION = {
  logs: 'logChannelId',
  farmlog: 'farmLogChannelId',
  proof: 'proofChannelId',
  registration: 'registrationChannelId',
  ranking: 'rankingChannelId',
  goal: 'goalChannelId'
};

const CHANNEL_LABEL_BY_ACTION = {
  logs: 'Logs',
  farmlog: 'Log Farm',
  proof: 'Prints',
  registration: 'Cadastro',
  ranking: 'Ranking',
  goal: 'Meta'
};

const ROLE_FIELD_BY_ACTION = {
  master: ['adminRoleIds', 'master'],
  admin: ['adminRoleIds', 'admin'],
  member: ['memberRoleId'],
  approver: ['approverRoleId']
};

const ROLE_LABEL_BY_ACTION = {
  master: 'Cargo Master',
  admin: 'Cargo Admin',
  member: 'Cargo Membro',
  approver: 'Cargo Aprovador'
};

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cfg:back').setLabel('Voltar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg:close').setLabel('Fechar').setStyle(ButtonStyle.Danger)
  );
}

function writeNestedConfigValue(config, fieldPath, value) {
  if (fieldPath.length === 2) {
    if (!config[fieldPath[0]]) config[fieldPath[0]] = {};
    config[fieldPath[0]][fieldPath[1]] = value;
    return;
  }
  config[fieldPath[0]] = value;
}

module.exports = {
  customIdPrefix: 'cfg',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberMaster({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Somente o cargo Master pode usar esta configuração.' });
    }

    const [, action, extra] = String(interaction.customId).split(':');

    if (interaction.isButton()) {
      if (action === 'close') {
        return interaction.update({ content: 'Painel fechado.', embeds: [], components: [] });
      }
      if (action === 'back') {
        const db2 = client.db.readGuildDb(interaction.guildId);
        return interaction.update({ embeds: [renderConfigEmbed(db2)], components: renderConfigRows(db2), content: '' });
      }

      if (action === 'channel') {
        const targetAction = extra;
        const key = CHANNEL_FIELD_BY_ACTION[targetAction];
        if (!key) return;
        const select = new ChannelSelectMenuBuilder()
          .setCustomId(`cfg:setChannel:${key}`)
          .setPlaceholder('Selecione um canal')
          .addChannelTypes(ChannelType.GuildText);

        return interaction.update({
          embeds: [
            renderConfigEmbed(db).setDescription(
              `Selecione o canal para **${CHANNEL_LABEL_BY_ACTION[targetAction]}**.`
            )
          ],
          components: [new ActionRowBuilder().addComponents(select), backRow()],
          content: ''
        });
      }

      if (action === 'role') {
        const targetAction = extra;
        const roleField = ROLE_FIELD_BY_ACTION[targetAction];
        if (!roleField) return;
        const select = new RoleSelectMenuBuilder().setCustomId(`cfg:setRole:${targetAction}`).setPlaceholder('Selecione um cargo');
        return interaction.update({
          embeds: [renderConfigEmbed(db).setDescription(`Selecione o **${ROLE_LABEL_BY_ACTION[targetAction]}**.`)],
          components: [new ActionRowBuilder().addComponents(select), backRow()],
          content: ''
        });
      }

      if (action === 'toggle' && extra === 'weekly') {
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
        await interaction.message.edit({ embeds: [renderConfigEmbed(db3)], components: renderConfigRows(db3), content: 'Salvo.' });
        return;
      }

      if (action === 'toggle' && extra === 'dm') {
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
        await interaction.message.edit({ embeds: [renderConfigEmbed(db3)], components: renderConfigRows(db3), content: 'Salvo.' });
        return;
      }

      if (action === 'toggle' && extra === 'logs') {
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
        await interaction.message.edit({ embeds: [renderConfigEmbed(db3)], components: renderConfigRows(db3), content: 'Salvo.' });
        return;
      }

      if (action === 'toggle' && extra === 'registration') {
        return safeReply(interaction, {
          ephemeral: true,
          embeds: [errorEmbed({ description: 'Essa opção ainda não está pronta.' })]
        });
      }
    }

    if (interaction.isChannelSelectMenu()) {
      if (action !== 'setChannel') return;
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
      if (action !== 'setRole') return;
      await interaction.deferUpdate();
      const selected = interaction.values?.[0] ?? '';
      const roleField = ROLE_FIELD_BY_ACTION[extra];
      if (!roleField) return;

      await client.db.updateGuildDb(interaction.guildId, (db2) => {
        writeNestedConfigValue(db2.config, roleField, selected);
      });

      await sendGuildLog({
        client,
        guildId: interaction.guildId,
        title: 'Cargo atualizado',
        user: interaction.user,
        accent: 'warning',
        fields: [
          { name: 'Campo', value: ROLE_LABEL_BY_ACTION[extra], inline: true },
          { name: 'Cargo', value: selected ? `<@&${selected}>` : 'Nenhum', inline: true }
        ]
      });

      const db3 = client.db.readGuildDb(interaction.guildId);
      await interaction.message.edit({ embeds: [renderConfigEmbed(db3)], components: interaction.message.components, content: 'Salvo.' });
      return;
    }

    return safeReply(interaction, { ephemeral: true, content: 'Ação não reconhecida.' });
  }
};
