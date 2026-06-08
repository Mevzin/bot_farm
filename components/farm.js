const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const { createSession, getSession } = require('../utils/sessions');
const { parsePositiveInt } = require('../utils/validate');
const { commitFarm } = require('../utils/farm');

module.exports = {
  customIdPrefix: 'farm',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    const [, action] = String(interaction.customId).split(':');

    if (interaction.isStringSelectMenu()) {
      if (action !== 'select') return;
      const category = interaction.values?.[0];
      if (!category) return;

      createSession({
        client,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        type: 'farm',
        data: { category },
        ttlMs: 3 * 60_000
      });

      const modal = new ModalBuilder().setCustomId('farm:modal').setTitle(`Farm - ${category}`);
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('qty')
            .setLabel('Quantidade farmada')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 150')
        )
      );
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
      if (action !== 'modal') return;
      const session = getSession({ client, guildId: interaction.guildId, userId: interaction.user.id });
      if (!session || session.type !== 'farm') {
        return safeReply(interaction, { ephemeral: true, content: 'Sessão expirada. Execute /farm novamente.' });
      }

      const qty = parsePositiveInt(interaction.fields.getTextInputValue('qty'));
      if (!qty) {
        return safeReply(interaction, { ephemeral: true, content: 'Quantidade inválida. Use apenas números positivos.' });
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        await commitFarm({
          client,
          guildId: interaction.guildId,
          user: interaction.user,
          category: session.data.category,
          qty
        });
        await interaction.editReply({ content: '✅ Farm registrado.' });
        return;
      } catch (err) {
        await interaction.editReply({ content: '❌ Falha ao registrar. Tente novamente.' });
        return;
      }
    }

    return safeReply(interaction, { ephemeral: true, content: 'Ação não reconhecida.' });
  }
};
