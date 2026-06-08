const { SlashCommandBuilder } = require('discord.js');

const { isMemberAdmin } = require('../utils/permissions');
const { checkAndSetCooldown } = require('../utils/cooldown');
const { parsePositiveInt } = require('../utils/validate');
const { commitWash } = require('../utils/wash');
const { successEmbed, errorEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('limpo')
    .setDescription('Registrar lavagem (admin)')
    .addUserOption((opt) => opt.setName('usuario').setDescription('Usuário que será lavado').setRequired(true))
    .addStringOption((opt) => opt.setName('valor').setDescription('Valor sujo a lavar (inteiro)').setRequired(true)),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Use este comando dentro de um servidor.' })] });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'limpo',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: `Aguarde ${cooldown}s para usar novamente.` })] });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Sem permissão.' })] });
    }

    const user = interaction.options.getUser('usuario', true);
    const valueRaw = interaction.options.getString('valor', true);
    const dirtyAmount = parsePositiveInt(valueRaw);
    if (!dirtyAmount) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Valor inválido. Use apenas números positivos.' })] });
    }

    await interaction.deferReply({ ephemeral: true });
    const baseDir = require('node:path').join(__dirname, '..');

    try {
      const result = await commitWash({
        client,
        baseDir,
        guildId: interaction.guildId,
        userId: user.id,
        adminUser: interaction.user,
        dirtyAmount
      });
      await interaction.editReply({
        embeds: [
          successEmbed({
            title: 'Lavagem registrada',
            description: `Usuário: <@${user.id}>\nLavado: **$${dirtyAmount.toLocaleString('pt-BR')}** → Limpo: **$${result.cleanAmount.toLocaleString('pt-BR')}**`
          })
        ]
      });
      return;
    } catch (err) {
      const msg = err?.code === 'INSUFFICIENT_DIRTY' ? 'Saldo sujo insuficiente para lavar.' : 'Falha ao registrar lavagem.';
      await interaction.editReply({ embeds: [errorEmbed({ description: msg })] });
    }
  }
};

