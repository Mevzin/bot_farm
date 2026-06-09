const { EmbedBuilder } = require('discord.js');

const { DateTime } = require('luxon');
const { BRAND, COLORS, EMOJIS } = require('./constants');

function makeBase({ title, description, user, color, icon, fields, thumbnailUrl, imageUrl }) {
  const embed = new EmbedBuilder()
    .setColor(color ?? COLORS.neutral)
    .setTimestamp(new Date())
    .setFooter({ text: BRAND.footer });

  const finalTitle = title ? `${icon ? `${icon} ` : ''}${title}` : icon ? icon : '';
  if (finalTitle) embed.setTitle(finalTitle);
  if (description) embed.setDescription(description);
  if (Array.isArray(fields) && fields.length) embed.addFields(fields);

  if (user) {
    embed.setAuthor({
      name: user.tag ?? user.username ?? BRAND.name,
      iconURL: user.displayAvatarURL ? user.displayAvatarURL() : undefined
    });
    if (!thumbnailUrl && user.displayAvatarURL) embed.setThumbnail(user.displayAvatarURL());
  }

  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  if (imageUrl) embed.setImage(imageUrl);

  return embed;
}

function successEmbed({ title, description, user, fields, thumbnailUrl, imageUrl } = {}) {
  return makeBase({
    title: title ?? 'Sucesso',
    description,
    user,
    fields,
    thumbnailUrl,
    imageUrl,
    icon: EMOJIS.success,
    color: COLORS.success
  });
}

function errorEmbed({ title, description, user, fields, thumbnailUrl, imageUrl } = {}) {
  return makeBase({
    title: title ?? 'Erro',
    description,
    user,
    fields,
    thumbnailUrl,
    imageUrl,
    icon: EMOJIS.danger,
    color: COLORS.danger
  });
}

function warningEmbed({ title, description, user, fields, thumbnailUrl, imageUrl } = {}) {
  return makeBase({
    title: title ?? 'Aviso',
    description,
    user,
    fields,
    thumbnailUrl,
    imageUrl,
    icon: EMOJIS.warning,
    color: COLORS.warning
  });
}

function infoEmbed({ title, description, user, fields, thumbnailUrl, imageUrl } = {}) {
  return makeBase({
    title: title ?? 'Informações',
    description,
    user,
    fields,
    thumbnailUrl,
    imageUrl,
    icon: EMOJIS.info,
    color: COLORS.info
  });
}

function logEmbed({ title, description, user, fields, imageUrl, status, accent, includeStamp = true } = {}) {
  const statusIcon =
    status === 'success'
      ? EMOJIS.success
      : status === 'danger'
        ? EMOJIS.danger
        : status === 'warning'
          ? EMOJIS.warning
          : EMOJIS.info;

  const color =
    accent === 'success'
      ? COLORS.success
      : accent === 'danger'
        ? COLORS.danger
        : accent === 'warning'
          ? COLORS.warning
          : accent === 'info'
            ? COLORS.info
            : COLORS.neutral;

  const stamp = DateTime.local().toFormat('dd/LL/yyyy HH:mm:ss');
  const fullFields = [
    ...(Array.isArray(fields) ? fields : []),
    ...(includeStamp ? [{ name: '🕒 Data/Hora', value: stamp, inline: true }] : [])
  ];

  return makeBase({
    title,
    description,
    user,
    fields: fullFields,
    imageUrl,
    icon: statusIcon,
    color
  });
}

module.exports = {
  successEmbed,
  errorEmbed,
  warningEmbed,
  infoEmbed,
  logEmbed
};
