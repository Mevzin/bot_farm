function createCustomId({ prefix, action, guildId, userId, extra }) {
  const ts = Date.now().toString(36);
  const nonce = Math.random().toString(16).slice(2, 8);
  const parts = [prefix, action, guildId, userId, ts, nonce];
  if (Array.isArray(extra) && extra.length) parts.push(...extra.map((x) => String(x)));
  return parts.join(':');
}

function parseCustomId(customId) {
  const parts = String(customId ?? '').split(':');
  const [prefix, action, guildId, userId, ts, nonce, ...rest] = parts;
  return { prefix, action, guildId, userId, ts, nonce, rest };
}

function assertCustomIdOwner({ interaction, parsed }) {
  if (!interaction.inGuild()) return false;
  if (parsed.guildId && parsed.guildId !== interaction.guildId) return false;
  if (parsed.userId && parsed.userId !== interaction.user.id) return false;
  return true;
}

module.exports = {
  createCustomId,
  parseCustomId,
  assertCustomIdOwner
};

