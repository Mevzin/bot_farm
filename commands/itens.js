const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} = require('discord.js');

const { buildPanelEmbed } = require('../utils/embeds');
const { isMemberAdmin } = require('../utils/permissions');
const { checkAndSetCooldown } = require('../utils/cooldown');

function renderItemsEmbed(db) {
  const items = Array.isArray(db.items) ? db.items : [];
  const lines = items
    .slice(0, 20)
    .map((it) => {
      const qty = Number(db.chest?.stockByItemId?.[it.id] ?? 0);
      return `• **${it.name}** — Qtd: **${qty}** — (${it.category})`;
    })
    .join('\n');

  return buildPanelEmbed({
    title: 'Painel de Itens',
    description: lines || 'Nenhum item cadastrado ainda.'
  });
}

module.exports = {
  data: new SlashCommandBuilder().setName('itens').setDescription('Painel administrativo de itens'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, content: 'Use este comando dentro de um servidor.' });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'itens',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, content: `Aguarde ${cooldown}s para usar novamente.` });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Somente Admin/Master pode gerenciar itens.' });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('item:add').setLabel('Adicionar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('item:edit').setLabel('Editar').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('item:remove').setLabel('Remover').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('item:list').setLabel('Visualizar').setStyle(ButtonStyle.Secondary)
    );

    return safeReply(interaction, { ephemeral: true, embeds: [renderItemsEmbed(db)], components: [row] });
  },
  renderItemsEmbed
};
