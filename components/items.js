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
const { newId } = require('../utils/id');
const { buildPanelEmbed } = require('../utils/embeds');
const { renderItemsEmbed } = require('../commands/itens');

function itemsSelect(db, customId, placeholder) {
  const items = Array.isArray(db.items) ? db.items : [];
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(
      items.slice(0, 25).map((it) => ({
        label: it.name.slice(0, 100),
        description: `${it.category} | Qtd: ${Number(db.chest?.stockByItemId?.[it.id] ?? 0)}`.slice(0, 100),
        value: it.id
      }))
    );
}

function mainButtonsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('item:add').setLabel('Adicionar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('item:edit').setLabel('Editar').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('item:remove').setLabel('Remover').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('item:list').setLabel('Visualizar').setStyle(ButtonStyle.Secondary)
  );
}

function backRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('item:back').setLabel('Voltar').setStyle(ButtonStyle.Secondary)
  );
}

function normalizeIconUrl(url) {
  let v = String(url ?? '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) return '';
  if (v.toLowerCase().startsWith('http://')) v = `https://${v.slice('http://'.length)}`;
  return v;
}

function renderItemDetailEmbed(db, item) {
  const qty = Number(db.chest?.stockByItemId?.[item.id] ?? 0);
  const thumbnailUrl = normalizeIconUrl(item.iconUrl);
  return buildPanelEmbed({
    title: item.name,
    description: `Categoria: **${item.category}**\nQuantidade disponível: **${qty}**`,
    thumbnailUrl: thumbnailUrl || undefined
  });
}

module.exports = {
  customIdPrefix: 'item',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Sem permissão.' });
    }

    const [, action, extra] = String(interaction.customId).split(':');

    if (interaction.isButton()) {
      if (action === 'list') {
        const db2 = client.db.readGuildDb(interaction.guildId);
        const items = Array.isArray(db2.items) ? db2.items : [];
        if (!items.length) {
          return safeReply(interaction, { ephemeral: true, content: 'Não há itens cadastrados.' });
        }
        const menu = itemsSelect(db2, 'item:select:view', 'Selecione um item para ver ícone + detalhes');
        return interaction.update({
          content: '',
          embeds: [renderItemsEmbed(db2)],
          components: [new ActionRowBuilder().addComponents(menu), backRow()]
        });
      }

      if (action === 'add') {
        const modal = new ModalBuilder().setCustomId('item:modal:add').setTitle('Adicionar Item');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('name').setLabel('Nome').setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('category')
              .setLabel('Categoria')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('iconUrl')
              .setLabel('URL do Ícone (opcional)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          )
        );
        return interaction.showModal(modal);
      }

      if (action === 'back') {
        const db2 = client.db.readGuildDb(interaction.guildId);
        return interaction.update({ content: '', embeds: [renderItemsEmbed(db2)], components: [mainButtonsRow()] });
      }

      if (action === 'edit' || action === 'remove') {
        const items = Array.isArray(db.items) ? db.items : [];
        if (!items.length) {
          return safeReply(interaction, { ephemeral: true, content: 'Não há itens cadastrados.' });
        }
        const menu = itemsSelect(
          db,
          action === 'edit' ? 'item:select:edit' : 'item:select:remove',
          action === 'edit' ? 'Selecione um item para editar' : 'Selecione um item para remover'
        );
        return interaction.update({ components: [new ActionRowBuilder().addComponents(menu)] });
      }

      if (action === 'confirmRemove') {
        await interaction.deferUpdate();
        const itemId = extra;
        const item = (db.items ?? []).find((x) => x.id === itemId);
        if (!item) {
          return safeReply(interaction, { ephemeral: true, content: 'Item não encontrado.' });
        }
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.items = (db2.items ?? []).filter((x) => x.id !== itemId);
          delete db2.chest.stockByItemId[itemId];
        });

        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Item removido',
          user: interaction.user,
          fields: [
            { name: 'Item', value: item.name, inline: true },
            { name: 'Categoria', value: item.category, inline: true }
          ]
        });

        const db3 = client.db.readGuildDb(interaction.guildId);
        await interaction.message.edit({ embeds: [renderItemsEmbed(db3)], components: [mainButtonsRow()], content: '' });
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (action !== 'select') return;
      const mode = extra;
      const itemId = interaction.values?.[0];
      const item = (db.items ?? []).find((x) => x.id === itemId);
      if (!item) return safeReply(interaction, { ephemeral: true, content: 'Item não encontrado.' });

      if (mode === 'view') {
        const db2 = client.db.readGuildDb(interaction.guildId);
        const freshItem = (db2.items ?? []).find((x) => x.id === itemId) ?? item;
        const menu = itemsSelect(db2, 'item:select:view', 'Trocar item');
        return interaction.update({
          content: '',
          embeds: [renderItemDetailEmbed(db2, freshItem)],
          components: [new ActionRowBuilder().addComponents(menu), backRow()]
        });
      }

      if (mode === 'edit') {
        const modal = new ModalBuilder().setCustomId(`item:modal:edit:${itemId}`).setTitle('Editar Item');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('name')
              .setLabel('Nome')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(item.name)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('category')
              .setLabel('Categoria')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setValue(item.category)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('iconUrl')
              .setLabel('URL do Ícone (opcional)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
              .setValue(item.iconUrl ?? '')
          )
        );
        return interaction.showModal(modal);
      }

      if (mode === 'remove') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`item:confirmRemove:${itemId}`)
            .setLabel(`Confirmar remoção: ${item.name.slice(0, 40)}`)
            .setStyle(ButtonStyle.Danger)
        );
        return interaction.update({
          embeds: [renderItemsEmbed(db)],
          components: [row],
          content: 'Confirme a remoção do item.'
        });
      }
    }

    if (interaction.isModalSubmit()) {
      if (action !== 'modal') return;
      const mode = extra;

      if (mode === 'add') {
        await interaction.deferReply({ ephemeral: true });
        const name = interaction.fields.getTextInputValue('name').trim();
        const category = interaction.fields.getTextInputValue('category').trim();
        const iconUrl = interaction.fields.getTextInputValue('iconUrl').trim();

        const id = newId('item');
        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          db2.items.push({ id, name, category, iconUrl: iconUrl || '' });
          if (!db2.chest.stockByItemId[id]) db2.chest.stockByItemId[id] = 0;
        });

        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Item adicionado',
          user: interaction.user,
          fields: [
            { name: 'Nome', value: name, inline: true },
            { name: 'Categoria', value: category, inline: true },
            { name: 'Ícone', value: iconUrl || '—', inline: false }
          ]
        });

        const db3 = client.db.readGuildDb(interaction.guildId);
        await interaction.editReply({ embeds: [renderItemsEmbed(db3)] });
        return;
      }

      if (mode === 'edit') {
        await interaction.deferReply({ ephemeral: true });
        const itemId = String(interaction.customId).split(':')[3];
        const name = interaction.fields.getTextInputValue('name').trim();
        const category = interaction.fields.getTextInputValue('category').trim();
        const iconUrl = interaction.fields.getTextInputValue('iconUrl').trim();

        const before = (db.items ?? []).find((x) => x.id === itemId);
        if (!before) return safeReply(interaction, { ephemeral: true, content: 'Item não encontrado.' });

        await client.db.updateGuildDb(interaction.guildId, (db2) => {
          const idx = (db2.items ?? []).findIndex((x) => x.id === itemId);
          if (idx >= 0) db2.items[idx] = { ...db2.items[idx], name, category, iconUrl: iconUrl || '' };
        });

        await sendGuildLog({
          client,
          guildId: interaction.guildId,
          title: 'Item editado',
          user: interaction.user,
          fields: [
            { name: 'Antes', value: `${before.name} (${before.category})`, inline: false },
            { name: 'Depois', value: `${name} (${category})`, inline: false }
          ]
        });

        const db3 = client.db.readGuildDb(interaction.guildId);
        await interaction.editReply({ embeds: [renderItemsEmbed(db3)] });
        return;
      }
    }

    return safeReply(interaction, { ephemeral: true, content: 'Ação não reconhecida.' });
  }
};
