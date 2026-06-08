const { SlashCommandBuilder } = require('discord.js');

const { checkAndSetCooldown } = require('../utils/cooldown');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registro')
    .setDescription('Enviar solicitação de registro para aprovação')
    .addUserOption((opt) => opt.setName('discord').setDescription('Usuário do Discord').setRequired(true))
    .addStringOption((opt) => opt.setName('nome').setDescription('Nome').setRequired(true))
    .addStringOption((opt) => opt.setName('vulgo').setDescription('Vulgo').setRequired(true))
    .addStringOption((opt) => opt.setName('numero').setDescription('Número').setRequired(true))
    .addStringOption((opt) => opt.setName('idcidade').setDescription('ID cidade').setRequired(true)),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Use este comando dentro de um servidor.' })] });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'registro',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: `Aguarde ${cooldown}s para usar novamente.` })] });
    }

    await interaction.deferReply({ ephemeral: true });

    const candidate = interaction.options.getUser('discord', true);
    const data = {
      candidateId: candidate.id,
      name: interaction.options.getString('nome', true).trim(),
      nick: interaction.options.getString('vulgo', true).trim(),
      number: interaction.options.getString('numero', true).trim(),
      cityId: interaction.options.getString('idcidade', true).trim(),
      createdBy: interaction.user.id,
      createdAt: new Date().toISOString()
    };

    const db = client.db.readGuildDb(interaction.guildId);
    const channelId = db?.config?.registryChannelId || interaction.channelId;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply({ embeds: [errorEmbed({ description: 'Canal de registro inválido.' })] });
      return;
    }

    const regId = `reg_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
    await client.db.updateGuildDb(interaction.guildId, (db2) => {
      if (!db2.registrations) db2.registrations = { pending: {} };
      db2.registrations.pending[regId] = data;
    });

    const { buildRegistrationMessage } = require('../utils/registration');
    const payload = buildRegistrationMessage({ guildId: interaction.guildId, regId, data, candidate });
    const sent = await channel.send(payload);

    await client.db.updateGuildDb(interaction.guildId, (db2) => {
      if (db2.registrations?.pending?.[regId]) db2.registrations.pending[regId].messageId = sent.id;
      if (db2.registrations?.pending?.[regId]) db2.registrations.pending[regId].channelId = channel.id;
    });

    await interaction.editReply({
      embeds: [successEmbed({ title: 'Registro enviado', description: `Solicitação enviada no canal <#${channel.id}>.` })]
    });
  }
};

