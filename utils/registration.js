const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const { warningEmbed } = require('./embedBuilder');
const { createCustomId } = require('./customId');
const { EMOJIS } = require('./constants');

function buildRegistrationEmbed({ data, candidate }) {
  return warningEmbed({
    title: 'Solicitação de Registro',
    user: candidate,
    fields: [
      { name: 'Nome', value: data.name, inline: true },
      { name: 'Vulgo', value: data.nick, inline: true },
      { name: 'Número', value: data.number, inline: true },
      { name: 'ID Cidade', value: data.cityId, inline: true },
      { name: 'Discord', value: `<@${data.candidateId}> (\`${data.candidateId}\`)`, inline: false }
    ],
    thumbnailUrl: candidate.displayAvatarURL ? candidate.displayAvatarURL() : undefined
  });
}

function buildRegistrationButtons({ guildId, regId, candidateId }) {
  const approveId = createCustomId({ prefix: 'reg', action: 'approve', guildId, userId: candidateId, extra: [regId] });
  const rejectId = createCustomId({ prefix: 'reg', action: 'reject', guildId, userId: candidateId, extra: [regId] });
  const pendingId = createCustomId({ prefix: 'reg', action: 'pending', guildId, userId: candidateId, extra: [regId] });

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(approveId).setLabel(`${EMOJIS.approve} Aprovar`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(rejectId).setLabel(`${EMOJIS.reject} Reprovar`).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(pendingId).setLabel(`${EMOJIS.pending} Pendenciar`).setStyle(ButtonStyle.Secondary)
  );
}

function buildRegistrationMessage({ guildId, regId, data, candidate }) {
  return {
    embeds: [buildRegistrationEmbed({ data, candidate })],
    components: [buildRegistrationButtons({ guildId, regId, candidateId: data.candidateId })]
  };
}

module.exports = {
  buildRegistrationMessage
};

