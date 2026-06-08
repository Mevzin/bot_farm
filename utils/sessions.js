function getSessionKey({ guildId, userId }) {
  return `${guildId}:${userId}`;
}

function createSession({ client, guildId, channelId, userId, type, data, ttlMs, onAttachment }) {
  const key = getSessionKey({ guildId, userId });
  const expiresAt = Date.now() + ttlMs;
  const session = {
    key,
    guildId,
    channelId,
    userId,
    type,
    data: data ?? {},
    expiresAt,
    onAttachment: typeof onAttachment === 'function' ? onAttachment : null
  };

  client.sessions.set(key, session);

  setTimeout(() => {
    const current = client.sessions.get(key);
    if (current?.expiresAt === expiresAt) client.sessions.delete(key);
  }, ttlMs).unref();

  return session;
}

function getSession({ client, guildId, userId }) {
  const key = getSessionKey({ guildId, userId });
  const session = client.sessions.get(key) ?? null;
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    client.sessions.delete(key);
    return null;
  }
  return session;
}

function clearSession({ client, guildId, userId }) {
  const key = getSessionKey({ guildId, userId });
  client.sessions.delete(key);
}

module.exports = {
  createSession,
  getSession,
  clearSession
};

