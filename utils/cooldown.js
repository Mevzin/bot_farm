function checkAndSetCooldown({ client, key, userId, seconds }) {
    const now = Date.now();
    const ms = Math.max(0, Number(seconds ?? 0)) * 1000;

    if (!client.cooldowns.has(key)) client.cooldowns.set(key, new Map());
    const bucket = client.cooldowns.get(key);

    const until = bucket.get(userId) ?? 0;
    if (until > now) {
        return Math.ceil((until - now) / 1000);
    }

    bucket.set(userId, now + ms);
    setTimeout(() => bucket.delete(userId), ms).unref();
    return 0;
}

module.exports = { checkAndSetCooldown };

