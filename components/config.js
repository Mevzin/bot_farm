const {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const { isMemberMaster } = require('../utils/permissions');
const { sendGuildLog } = require('../utils/audit');
const { refreshStatsMessage } = require('../utils/stats');
const { ensureGoalMessage } = require('../utils/goal');
const { renderPanel } = require('../commands/configurar');
const { errorEmbed } = require('../utils/embedBuilder');
const { parsePercentage, parsePositiveInt } = require('../utils/validate');

const CHANNEL_FIELD_BY_ACTION = {
  logs: 'logChannelId',
  registration: 'registrationChannelId',
  purchases: 'purchaseLogChannelId',
  sales: 'salesLogChannelId',
  finance: 'financeChannelId',
  chest: 'chestChannelId',
  ranking: 'rankingChannelId',
  goal: 'goalChannelId'
};

const CHANNEL_LABEL_BY_ACTION = {
  logs: 'Logs Gerais',
  registration: 'Registro',
  purchases: 'Compras',
  sales: 'Vendas',
  finance: 'Financeiro',
  chest: 'Bau',
  ranking: 'Ranking',
  goal: 'Meta'
};

const ROLE_FIELD_BY_ACTION = {
  leader: ['roleIds', 'leader'],
  administration: ['roleIds', 'administration'],
  management: ['roleIds', 'management'],
  member: ['roleIds', 'member'],
  recruiter: ['roleIds', 'recruiter']
};

const ROLE_LABEL_BY_ACTION = {
  leader: 'Cargo Lider',
  administration: 'Cargo Administracao',
  management: 'Cargo Gerencia',
  member: 'Cargo Membro',
  recruiter: 'Cargo Recrutador'
};

function writeNestedConfigValue(config, fieldPath, value) {
  if (fieldPath.length === 2) {
    if (!config[fieldPath[0]]) config[fieldPath[0]] = {};
    config[fieldPath[0]][fieldPath[1]] = value;
    return;
  }
  config[fieldPath[0]] = value;
}

function updatePanelMessage(interaction, panel, db, content = '') {
  const payload = renderPanel(panel, db);
  return interaction.editReply({ ...payload, content });
}

function getPanelFromCustomId(rawId) {
  const parts = String(rawId).split(':');
  if (parts[1] === 'setChannel' || parts[1] === 'setRole') return parts[3] || 'main';
  return parts[3] || 'main';
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
        return interaction.update({ ...renderPanel('main', db2), content: '' });
      }

      if (action === 'panel') {
        const db2 = client.db.readGuildDb(interaction.guildId);
        return interaction.update({ ...renderPanel(extra, db2), content: '' });
      }

      if (action === 'channel') {
        const targetAction = extra;
        const key = CHANNEL_FIELD_BY_ACTION[targetAction];
        if (!key) return;
        const select = new ChannelSelectMenuBuilder()
          .setCustomId(`cfg:setChannel:${key}:channels`)
          .setPlaceholder('Selecione um canal')
          .addChannelTypes(ChannelType.GuildText);

        return interaction.update({
          ...renderPanel('channels', db),
          components: [new ActionRowBuilder().addComponents(select), ...renderPanel('channels', db).components.slice(-1)],
          content: ''
        });
      }

      if (action === 'role') {
        const targetAction = extra;
        const roleField = ROLE_FIELD_BY_ACTION[targetAction];
        if (!roleField) return;
        const select = new RoleSelectMenuBuilder().setCustomId(`cfg:setRole:${targetAction}:roles`).setPlaceholder('Selecione um cargo');
        return interaction.update({
          ...renderPanel('roles', db),
          components: [new ActionRowBuilder().addComponents(select), ...renderPanel('roles', db).components.slice(-1)],
          content: ''
        });
      }

      if (action === 'toggle') {
        await interaction.deferUpdate();
        const toggleFieldByAction = {
          meta: 'metaEnabled',
          donation: 'donationEnabled',
          ranking: 'rankingEnabled',
          registration: 'registrationEnabled',
          logs: 'logsEnabled',
          dm: 'dmEnabled'
        };
        const field = toggleFieldByAction[extra];
        if (!field) return;
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.config[field] = !db2.config[field];
        });
        const db3 = client.db.readGuildDb(interaction.guildId);
        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Sistema atualizado',
          user: interaction.user,
          accent: 'warning',
          fields: [
            { name: 'Campo', value: field, inline: true },
            { name: 'Status', value: db3.config[field] ? 'Ativo' : 'Desativado', inline: true }
          ]
        });
        if (field === 'rankingEnabled' && db3.config.rankingEnabled) {
          await refreshStatsMessage({ client, guildId: interaction.guildId }).catch(() => { });
        }
        if ((field === 'metaEnabled' || field === 'donationEnabled') && db3.config.metaEnabled) {
          await ensureGoalMessage({ client, guildId: interaction.guildId }).catch(() => { });
        }
        await updatePanelMessage(interaction, 'system', db3, 'Salvo.');
        return;
      }

      if (action === 'finance') {
        const modal = new ModalBuilder().setCustomId(`cfg:modal:${extra}:finance`).setTitle('Configurar Financeiro');
        if (extra === 'wash') {
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('value')
                .setLabel('Porcentagem de lavagem')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(String(db.config.washPercentage ?? 75))
            )
          );
          return interaction.showModal(modal);
        }
        if (extra === 'sale') {
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('value')
                .setLabel('Porcentagem do vendedor')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(String(db.config.salePercentage ?? 30))
            )
          );
          return interaction.showModal(modal);
        }
        if (extra === 'goal') {
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('campaignName')
                .setLabel('Nome da campanha')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue(String(db.goal?.campaignName || 'Meta da Faccao'))
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('target')
                .setLabel('Meta da faccao')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(String(db.goal?.target ?? 0))
            )
          );
          return interaction.showModal(modal);
        }
        if (extra === 'cash') {
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('value')
                .setLabel('Caixa da faccao')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(String(db.config.factionBalance ?? 0))
            )
          );
          return interaction.showModal(modal);
        }
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
      if (key === 'goalChannelId' || key === 'financeChannelId') {
        await ensureGoalMessage({ client, guildId: interaction.guildId }).catch(() => { });
      }

      const db3 = client.db.readGuildDb(interaction.guildId);
      await updatePanelMessage(interaction, getPanelFromCustomId(interaction.customId), db3, 'Salvo.');
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
      if (extra === 'leader') db3.config.adminRoleIds.master = selected;
      if (extra === 'administration') db3.config.adminRoleIds.admin = selected;
      if (extra === 'member') db3.config.memberRoleId = selected;
      if (extra === 'recruiter') db3.config.approverRoleId = selected;
      await updatePanelMessage(interaction, getPanelFromCustomId(interaction.customId), db3, 'Salvo.');
      return;
    }

    if (interaction.isModalSubmit()) {
      if (action !== 'modal') return;
      const mode = extra;
      await interaction.deferReply({ ephemeral: true });

      if (mode === 'wash' || mode === 'sale') {
        const value = parsePercentage(interaction.fields.getTextInputValue('value'));
        if (!value) {
          await interaction.editReply({ embeds: [errorEmbed({ description: 'Informe uma porcentagem entre 1 e 99.' })] });
          return;
        }
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          if (mode === 'wash') db2.config.washPercentage = value;
          if (mode === 'sale') db2.config.salePercentage = value;
        });
        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Percentual atualizado',
          user: interaction.user,
          fields: [{ name: 'Campo', value: mode === 'wash' ? 'Lavagem' : 'Venda', inline: true }, { name: 'Valor', value: `${value}%`, inline: true }]
        });
      } else if (mode === 'cash') {
        const value = parsePositiveInt(interaction.fields.getTextInputValue('value'));
        if (value === null) {
          await interaction.editReply({ embeds: [errorEmbed({ description: 'Informe um valor valido para o caixa.' })] });
          return;
        }
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.config.factionBalance = value;
        });
        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Caixa da faccao atualizado',
          user: interaction.user,
          fields: [{ name: 'Novo caixa', value: `$${value.toLocaleString('pt-BR')}`, inline: true }]
        });
      } else if (mode === 'goal') {
        const campaignName = interaction.fields.getTextInputValue('campaignName').trim() || 'Meta da Faccao';
        const target = parsePositiveInt(interaction.fields.getTextInputValue('target'));
        if (!target) {
          await interaction.editReply({ embeds: [errorEmbed({ description: 'Informe um valor valido para a meta.' })] });
          return;
        }
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.goal.campaignName = campaignName;
          db2.goal.target = target;
          if (db2.goal.current > target) db2.goal.current = target;
        });
        await ensureGoalMessage({ client, guildId: interaction.guildId }).catch(() => { });
        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Meta da faccao atualizada',
          user: interaction.user,
          fields: [
            { name: 'Campanha', value: campaignName, inline: true },
            { name: 'Meta', value: `$${target.toLocaleString('pt-BR')}`, inline: true }
          ]
        });
      }

      const db3 = client.db.readGuildDb(interaction.guildId);
      await interaction.editReply({ embeds: [renderPanel('finance', db3).embeds[0]] });
      return;
    }

    return safeReply(interaction, { ephemeral: true, content: 'Ação não reconhecida.' });
  }
};
