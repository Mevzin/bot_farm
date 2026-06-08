const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require('discord.js');

const { isMemberAdmin } = require('../utils/permissions');
const { infoEmbed, errorEmbed } = require('../utils/embedBuilder');
const { checkAndSetCooldown } = require('../utils/cooldown');

module.exports = {
  data: new SlashCommandBuilder().setName('auditoria').setDescription('Painel administrativo de auditoria'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Use este comando dentro de um servidor.' })] });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'auditoria',
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

    const typeMenu = new StringSelectMenuBuilder()
      .setCustomId('audit:setType')
      .setPlaceholder('Selecione o tipo')
      .addOptions(
        { label: 'Depósitos', value: 'deposit' },
        { label: 'Retiradas', value: 'withdraw' },
        { label: 'Lavagens', value: 'wash' },
        { label: 'Doações', value: 'donation' }
      );

    const userMenu = new UserSelectMenuBuilder().setCustomId('audit:setUser').setPlaceholder('Filtrar por usuário (opcional)');

    const embed = infoEmbed({
      title: 'Auditoria',
      description: 'Escolha um tipo e (opcionalmente) filtre por usuário.'
    });

    return safeReply(interaction, {
      ephemeral: true,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(typeMenu), new ActionRowBuilder().addComponents(userMenu)]
    });
  }
};

