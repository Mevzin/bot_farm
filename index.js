const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');

const { loadBotConfig } = require('./utils/config');
const { setupProcessErrorHandlers } = require('./utils/errors');
const { createLogger } = require('./utils/logger');
const { ensureDir } = require('./utils/fs');
const { loadCommands } = require('./utils/loader/commands');
const { loadEvents } = require('./utils/loader/events');
const { loadComponents } = require('./utils/loader/components');
const { startBackupScheduler } = require('./utils/backup');
const { createDb } = require('./utils/db');
const { createLockManager } = require('./utils/lockManager');
const { createTransactionManager } = require('./utils/transactionManager');

async function main() {
  const botConfig = loadBotConfig();

  ensureDir(path.join(__dirname, 'logs'));
  ensureDir(path.join(__dirname, 'database'));

  const logger = createLogger({ baseDir: __dirname });
  setupProcessErrorHandlers({ logger });

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
  });

  client.botConfig = botConfig;
  client.logger = logger;
  client.db = createDb({ baseDir: __dirname, logger });
  client.locks = createLockManager();
  client.tx = createTransactionManager({ db: client.db, lockManager: client.locks, logger });
  client.commands = new Collection();
  client.components = new Collection();
  client.cooldowns = new Map();
  client.sessions = new Map();

  loadCommands({ client, baseDir: __dirname, logger });
  loadComponents({ client, baseDir: __dirname, logger });
  loadEvents({ client, baseDir: __dirname, logger });

  startBackupScheduler({ baseDir: __dirname, logger, botConfig });

  await client.login(botConfig.token);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
