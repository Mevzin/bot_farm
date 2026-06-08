const { logEmbed } = require('./embedBuilder');

async function sendGuildLog({ client, guildId, title, user, fields, imageUrl, status, accent, description }) {
  const db = client.db.readGuildDb(guildId);
  const logChannelId = db?.config?.logChannelId;
  const enabled = db?.config?.logsEnabled !== false;

  const embed = logEmbed({ title, user, fields, imageUrl, status, accent, description });
  client.logger.info('log.action', {
    guildId,
    title,
    userId: user?.id ?? null,
    fields,
    imageUrl
  });

  if (!enabled) return;
  if (!logChannelId) return;
  const channel = await client.channels.fetch(logChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  await channel.send({ embeds: [embed] }).catch((err) => {
    client.logger.warn('log.channel.failed', { guildId, logChannelId, message: err?.message });
  });
}

module.exports = { sendGuildLog };
