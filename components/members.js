const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const { isMemberAdmin } = require('../utils/permissions');
const { sendGuildLog } = require('../utils/audit');
const { ensureUserStats, refreshStatsMessage } = require('../utils/stats');
const { renderMembersEmbed } = require('../commands/membros');

function isValidDiscordId(id) {
  return /^\d{17,20}$/.test(String(id).trim());
}

function membersSelect(db, customId, placeholder) {
  const members = Array.isArray(db.members) ? db.members : [];
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(
      members.slice(0, 25).map((m) => ({
        label: m.name.slice(0, 100),
        description: m.discordId,
        value: m.discordId
      }))
    );
}

module.exports = {
  customIdPrefix: 'mem',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Sem permissão.' });
    }

    const [, action, extra] = String(interaction.customId).split(':');

    if (interaction.isButton()) {
      if (action === 'list') {
        return interaction.update({ embeds: [renderMembersEmbed(client.db.readGuildDb(interaction.guildId))] });
      }

      if (action === 'add') {
        const modal = new ModalBuilder().setCustomId('mem:modal:add').setTitle('Adicionar Membro');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('name').setLabel('Nome').setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('discordId')
              .setLabel('Discord ID')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setPlaceholder('Ex: 123456789012345678')
          )
        );
        return interaction.showModal(modal);
      }

      if (action === 'edit' || action === 'remove') {
        const members = Array.isArray(db.members) ? db.members : [];
        if (!members.length) return safeReply(interaction, { ephemeral: true, content: 'Não há membros cadastrados.' });
        const menu = membersSelect(
          db,
          action === 'edit' ? 'mem:select:edit' : 'mem:select:remove',
          action === 'edit' ? 'Selecione um membro para editar' : 'Selecione um membro para remover'
        );
        return interaction.update({ components: [new ActionRowBuilder().addComponents(menu)] });
      }

      if (action === 'confirmRemove') {
        await interaction.deferUpdate();
        const discordId = extra;
        const member = (db.members ?? []).find((m) => m.discordId === discordId);
        if (!member) return safeReply(interaction, { ephemeral: true, content: 'Membro não encontrado.' });

        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.members = (db2.members ?? []).filter((m) => m.discordId !== discordId);
        });

        await refreshStatsMessage({ client, guildId: interaction.guildId }).catch(() => { });

        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Membro removido',
          user: interaction.user,
          fields: [
            { name: 'Nome', value: member.name, inline: true },
            { name: 'Discord ID', value: member.discordId, inline: true }
          ]
        });

        const db3 = client.db.readGuildDb(interaction.guildId);
        await interaction.message.edit({ embeds: [renderMembersEmbed(db3)], components: [], content: '' });
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (action !== 'select') return;
      const mode = extra;
      const discordId = interaction.values?.[0];
      const member = (db.members ?? []).find((m) => m.discordId === discordId);
      if (!member) return safeReply(interaction, { ephemeral: true, content: 'Membro não encontrado.' });

      if (mode === 'edit') {
        const modal = new ModalBuilder().setCustomId(`mem:modal:edit:${discordId}`).setTitle('Editar Membro');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('name')
              .setLabel('Nome')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(member.name)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('discordId')
              .setLabel('Discord ID')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(member.discordId)
          )
        );
        return interaction.showModal(modal);
      }

      if (mode === 'remove') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mem:confirmRemove:${discordId}`)
            .setLabel(`Confirmar remoção: ${member.name.slice(0, 40)}`)
            .setStyle(ButtonStyle.Danger)
        );
        return interaction.update({ embeds: [renderMembersEmbed(db)], components: [row], content: 'Confirme a remoção.' });
      }
    }

    if (interaction.isModalSubmit()) {
      if (action !== 'modal') return;
      const mode = extra;

      const name = interaction.fields.getTextInputValue('name').trim();
      const discordId = interaction.fields.getTextInputValue('discordId').trim();
      if (!isValidDiscordId(discordId)) {
        return safeReply(interaction, { ephemeral: true, content: 'Discord ID inválido.' });
      }

      if (mode === 'add') {
        await interaction.deferReply({ ephemeral: true });
        try {
          await client.db.updateGuildDb(interaction.guildId, (db2) => {
            const exists = (db2.members ?? []).some((m) => m.discordId === discordId);
            if (exists) {
              const err = new Error('DUPLICATE');
              err.code = 'DUPLICATE';
              throw err;
            }
            db2.members.push({ name, discordId });
            ensureUserStats(db2, discordId);
          });

          await refreshStatsMessage({ client, guildId: interaction.guildId }).catch(() => { });

          await sendGuildLog({
            client,
            guildId: interaction.guildId,
            title: 'Membro adicionado',
            user: interaction.user,
            fields: [
              { name: 'Nome', value: name, inline: true },
              { name: 'Discord ID', value: discordId, inline: true }
            ]
          });

          const db3 = client.db.readGuildDb(interaction.guildId);
          await interaction.editReply({ embeds: [renderMembersEmbed(db3)] });
          return;
        } catch (err) {
          const msg = err?.code === 'DUPLICATE' ? 'Este Discord ID já está cadastrado.' : 'Falha ao adicionar membro.';
          await interaction.editReply({ content: `❌ ${msg}`, embeds: [] });
          return;
        }
      }

      if (mode === 'edit') {
        await interaction.deferReply({ ephemeral: true });
        const beforeId = String(interaction.customId).split(':')[3];
        try {
          await client.db.updateGuildDb(interaction.guildId, (db2) => {
            const idx = (db2.members ?? []).findIndex((m) => m.discordId === beforeId);
            if (idx < 0) {
              const err = new Error('NOT_FOUND');
              err.code = 'NOT_FOUND';
              throw err;
            }
            const duplicate = beforeId !== discordId && (db2.members ?? []).some((m) => m.discordId === discordId);
            if (duplicate) {
              const err = new Error('DUPLICATE');
              err.code = 'DUPLICATE';
              throw err;
            }
            db2.members[idx] = { name, discordId };
            ensureUserStats(db2, discordId);
          });

          await refreshStatsMessage({ client, guildId: interaction.guildId }).catch(() => { });

          await sendGuildLog({
            client,
            guildId: interaction.guildId,
            title: 'Membro editado',
            user: interaction.user,
            fields: [
              { name: 'Nome', value: name, inline: true },
              { name: 'Discord ID', value: discordId, inline: true }
            ]
          });

          const db3 = client.db.readGuildDb(interaction.guildId);
          await interaction.editReply({ embeds: [renderMembersEmbed(db3)] });
          return;
        } catch (err) {
          const msg =
            err?.code === 'DUPLICATE'
              ? 'Este Discord ID já está cadastrado.'
              : err?.code === 'NOT_FOUND'
                ? 'Membro não encontrado.'
                : 'Falha ao editar membro.';
          await interaction.editReply({ content: `❌ ${msg}`, embeds: [] });
          return;
        }
      }
    }

    return safeReply(interaction, { ephemeral: true, content: 'Ação não reconhecida.' });
  }
};
