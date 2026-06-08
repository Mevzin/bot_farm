const path = require('node:path');
const { REST, Routes } = require('discord.js');

const { loadBotConfig } = require('../utils/config');
const { listJsFilesRecursive } = require('../utils/loader/files');

async function main() {
  const botConfig = loadBotConfig();

  const commandsDir = path.join(__dirname, '..', 'commands');
  const files = listJsFilesRecursive(commandsDir);
  const commands = [];

  for (const filePath of files) {
    const mod = require(filePath);
    if (mod?.data?.toJSON) commands.push(mod.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(botConfig.token);

  if (botConfig.guildId) {
    await rest.put(Routes.applicationGuildCommands(botConfig.clientId, botConfig.guildId), {
      body: commands
    });
    console.log(`Comandos registrados (GUILD): ${commands.length}`);
    return;
  }

  await rest.put(Routes.applicationCommands(botConfig.clientId), { body: commands });
  console.log(`Comandos registrados (GLOBAL): ${commands.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
