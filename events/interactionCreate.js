const { Events } = require('discord.js');

async function safeReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, { client }) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction, { client, safeReply });
        return;
      }

      if (
        interaction.isButton() ||
        interaction.isAnySelectMenu() ||
        interaction.isModalSubmit()
      ) {
        const rawId = interaction.customId || '';
        const prefix = rawId.split(':')[0];
        const handler = client.components.get(prefix);
        if (!handler) return;
        await handler.execute(interaction, { client, safeReply });
      }
    } catch (err) {
      client.logger.error('interaction.failed', {
        type: interaction.type,
        commandName: interaction.commandName ?? null,
        customId: interaction.customId ?? null,
        message: err?.message,
        stack: err?.stack
      });
      await safeReply(interaction, {
        ephemeral: true,
        content: 'Ocorreu um erro ao processar sua ação. Tente novamente.'
      }).catch(() => {});
    }
  }
};

