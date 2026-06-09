const { SlashCommandBuilder } = require('discord.js');

const { checkAndSetCooldown } = require('../utils/cooldown');
const { infoEmbed, errorEmbed } = require('../utils/embedBuilder');
const { getWashPercentage } = require('../utils/financeSettings');

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

module.exports = {
  data: new SlashCommandBuilder().setName('saldo').setDescription('Ver seu saldo atual em dinheiro sujo e previsão de limpo'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Use este comando dentro de um servidor.' })] });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'saldo',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: `Aguarde ${cooldown}s para usar novamente.` })] });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    const totals = db?.dirtyMoney?.byUserId?.[interaction.user.id] ?? { dirtyTotal: 0, cleanTotal: 0 };
    const dirtyTotal = Number(totals.dirtyTotal ?? 0);
    const washPercentage = getWashPercentage(db);
    const projectedClean = Math.floor((dirtyTotal * washPercentage) / 100);
    const washedClean = Number(totals.cleanTotal ?? 0);

    return safeReply(interaction, {
      ephemeral: true,
      embeds: [
        infoEmbed({
          title: 'Seu saldo',
          user: interaction.user,
          fields: [
            { name: 'Dinheiro Sujo', value: `$${money(dirtyTotal)}`, inline: true },
            { name: `Dinheiro Limpo (${washPercentage}%)`, value: `$${money(projectedClean)}`, inline: true },
            { name: 'Dinheiro Limpo Já Lavado', value: `$${money(washedClean)}`, inline: true }
          ]
        })
      ]
    });
  }
};
