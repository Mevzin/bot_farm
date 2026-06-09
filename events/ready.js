const { ActivityType, Events } = require('discord.js');
const path = require('node:path');

const { refreshStatsMessage, weeklyResetRanking } = require('../utils/stats');
const { ensureGoalMessage } = require('../utils/goal');
const { version } = require('../package.json');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    client.logger.info('bot.ready', { user: client.user?.tag });
    client.user.setPresence({
      activities: [
        {
          name: `Powered by Github.com/mevzin | v${version}`,
          type: ActivityType.Playing
        }
      ],
      status: 'online'
    });

    for (const guild of client.guilds.cache.values()) {
      client.db.ensureGuildDb(guild.id);
      await refreshStatsMessage({ client, guildId: guild.id }).catch(() => { });
      await ensureGoalMessage({ client, guildId: guild.id }).catch(() => { });
    }

    const baseDir = path.join(__dirname, '..');
    setInterval(() => {
      for (const guild of client.guilds.cache.values()) {
        weeklyResetRanking({ client, baseDir, guildId: guild.id }).catch(() => { });
      }
    }, 60 * 60_000).unref();
  }
};
