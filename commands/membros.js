const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} = require('discord.js');

const { buildPanelEmbed } = require('../utils/embeds');
const { isMemberAdmin } = require('../utils/permissions');
const { checkAndSetCooldown } = require('../utils/cooldown');

function renderMembersEmbed(db) {
  const members = Array.isArray(db.members) ? db.members : [];
  const lines = members
    .slice(0, 30)
    .map((m) => `• **${m.name}** — <@${m.discordId}> (\`${m.discordId}\`)`)
    .join('\n');

  return buildPanelEmbed({
    title: 'Membros',
    description: lines || 'Nenhum membro cadastrado.'
  });
}

module.exports = {
  data: new SlashCommandBuilder().setName('membros').setDescription('Gerenciamento interno de membros'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, content: 'Use este comando dentro de um servidor.' });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'membros',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, content: `Aguarde ${cooldown}s para usar novamente.` });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Somente Admin/Master pode gerenciar membros.' });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mem:add').setLabel('Adicionar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('mem:edit').setLabel('Editar').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mem:remove').setLabel('Remover').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('mem:list').setLabel('Listar').setStyle(ButtonStyle.Secondary)
    );

    return safeReply(interaction, { ephemeral: true, embeds: [renderMembersEmbed(db)], components: [row] });
  },
  renderMembersEmbed
};

