const { DateTime } = require('luxon');
const { infoEmbed, logEmbed } = require('./embedBuilder');

function nowFooter() {
  const dt = DateTime.local();
  return `Atualizado em ${dt.toFormat('dd/LL/yyyy HH:mm:ss')}`;
}

function buildLogEmbed({ title, user, fields, imageUrl }) {
  return logEmbed({ title, user, fields, imageUrl });
}

function buildPanelEmbed({ title, description, fields, thumbnailUrl, imageUrl }) {
  return infoEmbed({ title, description, fields, thumbnailUrl, imageUrl });
}

module.exports = {
  buildLogEmbed,
  buildPanelEmbed,
  nowFooter
};
