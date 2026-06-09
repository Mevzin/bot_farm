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
    if (db?.config?.registrationEnabled === false) {
      return safeReply(interaction, {
        ephemeral: true,
        embeds: [errorEmbed({ description: 'O sistema de registro está desativado no momento.' })]
      });
    }
    const channelId = db?.config?.registrationChannelId || '';
    if (!channelId) {
      return safeReply(interaction, {
        ephemeral: true,
        embeds: [errorEmbed({ description: 'Canal exclusivo de cadastro não configurado ou inválido.' })]
      });
    }

    const regId = `reg_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
    await client.db.updateGuildDb(interaction.guildId, (db2) => {
      if (!db2.registrations) db2.registrations = { pending: {} };
      db2.registrations.pending[regId] = data;
    });

    await safeReply(interaction, {
      ephemeral: true,
      embeds: [successEmbed({ description: 'Registro efetuado com sucesso, aguarde ser aprovado.' })]
    });

    const { buildRegistrationMessage } = require('../utils/registration');
    const payload = buildRegistrationMessage({ guildId: interaction.guildId, regId, data, candidate });

    const configured = await client.channels.fetch(channelId).catch(() => null);
    const configuredOk =
      configured &&
      configured.isTextBased() &&
      String(configured.guildId || '') === String(interaction.guildId);

    const fallback = interaction.channel;
    const fallbackOk = fallback && fallback.isTextBased();

    const targetChannel = configuredOk ? configured : fallbackOk ? fallback : null;
    if (!targetChannel) {
      await client.db.updateGuildDb(interaction.guildId, (db2) => {
        if (db2.registrations?.pending?.[regId]) delete db2.registrations.pending[regId];
      });
      await safeReply(interaction, {
        ephemeral: true,
        embeds: [errorEmbed({ description: 'Não foi possível encontrar um canal válido para enviar o card de registro.' })]
      }).catch(() => {});
      return;
    }

    try {
      const sent = await targetChannel.send(payload);
      await client.db.updateGuildDb(interaction.guildId, (db2) => {
        if (db2.registrations?.pending?.[regId]) db2.registrations.pending[regId].messageId = sent.id;
        if (db2.registrations?.pending?.[regId]) db2.registrations.pending[regId].channelId = targetChannel.id;
      });

      await safeReply(interaction, {
        ephemeral: true,
        embeds: [successEmbed({ description: `Card enviado para aprovação em <#${targetChannel.id}>.` })]
      }).catch(() => {});
    } catch (err) {
      const isMissingPerm = err?.code === 50013;
      const reason = isMissingPerm
        ? 'Sem permissão para enviar mensagens/embeds/botões no canal.'
        : 'Erro ao enviar mensagem no canal.';

      await client.db.updateGuildDb(interaction.guildId, (db2) => {
        if (db2.registrations?.pending?.[regId]) delete db2.registrations.pending[regId];
      });

      client.logger.warn('registration.send.failed', {
        guildId: interaction.guildId,
        regId,
        channelId: targetChannel.id,
        message: err?.message,
        code: err?.code ?? null
      });

      await safeReply(interaction, {
        ephemeral: true,
        embeds: [errorEmbed({ description: `${reason} Ajuste as permissões do bot e tente novamente.` })]
      }).catch(() => {});
    }
  }
};
