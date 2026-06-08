const fs = require('node:fs');
const path = require('node:path');

function loadBotConfig() {
  const configPath = path.join(__dirname, '..', 'config', 'bot.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Arquivo de configuração não encontrado: ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const cfg = JSON.parse(raw);

  if (!cfg.token || cfg.token === 'COLOQUE_SEU_TOKEN_AQUI') {
    throw new Error('Config inválida: preencha config/bot.json -> token');
  }
  if (!cfg.clientId || cfg.clientId === 'COLOQUE_O_CLIENT_ID_AQUI') {
    throw new Error('Config inválida: preencha config/bot.json -> clientId');
  }

  return {
    token: String(cfg.token),
    clientId: String(cfg.clientId),
    guildId: cfg.guildId ? String(cfg.guildId) : '',
    backupIntervalMinutes: Number(cfg.backupIntervalMinutes ?? 10),
    backupRetentionDays: Number(cfg.backupRetentionDays ?? 7),
    defaultCooldownSeconds: Number(cfg.defaultCooldownSeconds ?? 3)
  };
}

module.exports = { loadBotConfig };

