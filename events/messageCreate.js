const { Events } = require('discord.js');
const { getSession, clearSession } = require('../utils/sessions');
const { isImageAttachment } = require('../utils/validate');

module.exports = {
  name: Events.MessageCreate,
  async execute(message, { client }) {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;

      const session = getSession({ client, guildId: message.guild.id, userId: message.author.id });
      if (!session?.onAttachment) return;
      if (session.channelId && session.channelId !== message.channel.id) return;

      let attachment = message.attachments.first() ?? null;
      if (!attachment || !isImageAttachment(attachment)) {
        const embedImageUrl =
          message.embeds?.map((e) => e?.image?.url).find(Boolean) ||
          message.embeds?.map((e) => e?.thumbnail?.url).find(Boolean) ||
          '';
        if (!embedImageUrl) return;
        attachment = { url: embedImageUrl, name: 'embed-image.png', contentType: 'image/png' };
      }

      const onAttachment = session.onAttachment;
      clearSession({ client, guildId: message.guild.id, userId: message.author.id });

      await onAttachment({ message, attachment });
    } catch (err) {
      client.logger.error('messageCreate.failed', { message: err?.message, stack: err?.stack });
    }
  }
};
