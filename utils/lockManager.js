function createLockManager() {
  const locks = new Map();

  function lockKey(parts) {
    return parts.filter(Boolean).join(':');
  }

  async function withLock({ key, ttlMs }, fn) {
    const now = Date.now();
    const current = locks.get(key);
    if (current && current.expiresAt > now) {
      const err = new Error('LOCKED');
      err.code = 'LOCKED';
      throw err;
    }

    const expiresAt = now + Math.max(1, ttlMs ?? 30_000);
    locks.set(key, { expiresAt });

    try {
      return await fn();
    } finally {
      const latest = locks.get(key);
      if (latest?.expiresAt === expiresAt) locks.delete(key);
    }
  }

  return {
    lockKey,
    withLock
  };
}

module.exports = { createLockManager };

