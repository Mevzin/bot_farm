const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const { isMemberAdmin } = require('../utils/permissions');
const { parsePositiveInt } = require('../utils/validate');
const { ensureGoalMessage } = require('../utils/goal');
const { renderMetaEmbed } = require('../commands/meta');
const { sendGuildLog } = require('../utils/audit');

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('meta:back').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
  );
}

function panelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('meta:channel').setLabel('Canal da Meta').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('meta:config').setLabel('Configurar Campanha').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('meta:refresh').setLabel('Atualizar Mensagem').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('meta:clear').setLabel('Zerar Meta').setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  customIdPrefix: 'meta',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Sem permissão.' });
    }

    const [, action] = String(interaction.customId).split(':');

    if (interaction.isButton()) {
      if (action === 'back') {
        const db2 = client.db.readGuildDb(interaction.guildId);
        return interaction.update({ embeds: [renderMetaEmbed(db2)], components: [panelRow()], content: '' });
      }

      if (action === 'channel') {
        const select = new ChannelSelectMenuBuilder()
          .setCustomId('meta:setChannel')
          .setPlaceholder('Selecione um canal para a meta')
          .addChannelTypes(ChannelType.GuildText);
        return interaction.update({
          embeds: [renderMetaEmbed(db)],
          components: [new ActionRowBuilder().addComponents(select), backRow()],
          content: ''
        });
      }

      if (action === 'config') {
        const modal = new ModalBuilder().setCustomId('meta:modal:config').setTitle('Configurar Meta');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('campaignName')
              .setLabel('Nome da campanha')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(db.goal.campaignName || '')
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('target')
              .setLabel('Valor objetivo (número inteiro)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(String(db.goal.target ?? 0))
          )
        );
        return interaction.showModal(modal);
      }

      if (action === 'refresh') {
        await interaction.deferUpdate();
        await ensureGoalMessage({ client, guildId: interaction.guildId }).catch(() => {});
        const db2 = client.db.readGuildDb(interaction.guildId);
        await interaction.message.edit({ embeds: [renderMetaEmbed(db2)], components: [panelRow()], content: 'Atualizado.' });
        return;
      }

      if (action === 'clear') {
        await interaction.deferUpdate();
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.goal.campaignName = '';
          db2.goal.target = 0;
          db2.goal.current = 0;
          db2.goal.contributionsByUserId = {};
          db2.goal.contributions = [];
        });
        await ensureGoalMessage({ client, guildId: interaction.guildId }).catch(() => {});
        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Meta zerada',
          user: interaction.user,
          accent: 'warning'
        });
        const db2 = client.db.readGuildDb(interaction.guildId);
        await interaction.message.edit({ embeds: [renderMetaEmbed(db2)], components: [panelRow()], content: 'Meta zerada.' });
        return;
      }
    }

    if (interaction.isChannelSelectMenu()) {
      if (action !== 'setChannel') return;
      await interaction.deferUpdate();
      const selected = interaction.values?.[0] ?? '';
      await client.db.updateGuildDb(interaction.guildId, (db2) => {
        db2.config.goalChannelId = selected;
      });
      await ensureGoalMessage({ client, guildId: interaction.guildId }).catch(() => {});
      await sendGuildLog({
        client,
        guildId: interaction.guildId,
        title: 'Canal da meta atualizado',
        user: interaction.user,
        accent: 'warning',
        fields: [{ name: 'Canal', value: selected ? `<#${selected}>` : 'Nenhum', inline: true }]
      });

      const db2 = client.db.readGuildDb(interaction.guildId);
      await interaction.message.edit({ embeds: [renderMetaEmbed(db2)], components: [panelRow()], content: 'Salvo.' });
      return;
    }

    if (interaction.isModalSubmit()) {
      if (action !== 'modal') return;
      const [, , mode] = String(interaction.customId).split(':');
      if (mode !== 'config') return;

      await interaction.deferReply({ ephemeral: true });
      const campaignName = interaction.fields.getTextInputValue('campaignName').trim();
      const target = parsePositiveInt(interaction.fields.getTextInputValue('target'));
      if (!target) {
        await interaction.editReply({ content: 'Valor objetivo inválido. Use apenas números positivos.' });
        return;
      }

      await client.db.updateGuildDb(interaction.guildId, (db2) => {
        db2.goal.campaignName = campaignName;
        db2.goal.target = target;
        if (db2.goal.current > target) db2.goal.current = target;
      });
      await ensureGoalMessage({ client, guildId: interaction.guildId }).catch(() => {});
      await sendGuildLog({
        client,
        guildId: interaction.guildId,
        title: 'Meta configurada',
        user: interaction.user,
        accent: 'warning',
        fields: [
          { name: 'Campanha', value: campaignName || '—', inline: true },
          { name: 'Meta', value: `$${target.toLocaleString('pt-BR')}`, inline: true }
        ]
      });

      const db2 = client.db.readGuildDb(interaction.guildId);
      await interaction.editReply({ embeds: [renderMetaEmbed(db2)] });
      return;
    }

    return safeReply(interaction, { ephemeral: true, content: 'Ação não reconhecida.' });
  }
};

