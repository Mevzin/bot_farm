const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const { parseCustomId } = require('../utils/customId');
const { isMemberApprover } = require('../utils/permissions');
const { successEmbed, errorEmbed, warningEmbed, infoEmbed } = require('../utils/embedBuilder');
const { sendGuildLog } = require('../utils/audit');

function safeDm(user, payload) {
  return user.send(payload).catch(() => null);
}

function formatApprovedNickname({ cityId, nick, fallbackName }) {
  const city = String(cityId || '').trim();
  const vulgo = String(nick || '').trim() || String(fallbackName || '').trim();
  const raw = `(${city} | ${vulgo})`;
  if (raw.length <= 32) return raw;
  return raw.slice(0, 32);
}

async function applyApproval({ interaction, client, regId, candidateId, data }) {
  const db = client.db.readGuildDb(interaction.guildId);
  const memberRoleId = db?.config?.memberRoleId || '';

  const guild = interaction.guild;
  const member = await guild.members.fetch(candidateId).catch(() => null);
  if (!member) {
    await interaction.message.edit({ embeds: [errorEmbed({ title: 'Aprovação falhou', description: 'Membro não encontrado.' })], components: [] });
    return;
  }

  const nickname = formatApprovedNickname({ cityId: data.cityId, nick: data.nick, fallbackName: data.name });
  await member.setNickname(nickname).catch(() => null);
  if (memberRoleId) {
    await member.roles.add(memberRoleId).catch(() => null);
  }

  await client.db.updateGuildDb(interaction.guildId, (db2) => {
    if (db2.registrations?.pending?.[regId]) delete db2.registrations.pending[regId];
    const exists = (db2.members ?? []).some((m) => m.discordId === candidateId);
    if (!exists) {
      db2.members.push({
        name: data.name,
        discordId: candidateId,
        nick: data.nick,
        number: data.number,
        cityId: data.cityId
      });
    }
  });

  const candidateUser = await client.users.fetch(candidateId).catch(() => null);
  if (db?.config?.dmEnabled && candidateUser) {
    await safeDm(candidateUser, {
      embeds: [successEmbed({ title: 'Aprovado', description: `Seu registro foi aprovado em **${guild.name}**.` })]
    });
  }

  await sendGuildLog({
    client,
    guildId: interaction.guildId,
    title: 'Registro aprovado',
    user: interaction.user,
    accent: 'success',
    fields: [
      { name: '👤 Usuário', value: `<@${candidateId}>`, inline: true },
      { name: 'Vulgo', value: data.nick, inline: true },
      { name: 'ID Cidade', value: data.cityId, inline: true }
    ]
  });

  await interaction.message.edit({
    embeds: [
      successEmbed({
        title: 'Registro aprovado',
        description: `Aprovado por <@${interaction.user.id}>`,
        fields: [
          { name: 'Usuário', value: `<@${candidateId}>`, inline: true },
          { name: 'Nome', value: data.name, inline: true },
          { name: 'Vulgo', value: data.nick, inline: true },
          { name: 'ID Cidade', value: data.cityId, inline: true },
          { name: 'Nickname definido', value: nickname, inline: false }
        ]
      })
    ],
    components: []
  });
}

async function applyPending({ interaction }) {
  await interaction.message.edit({
    embeds: [infoEmbed({ title: 'Registro pendente', description: `Pendenciado por <@${interaction.user.id}>` })],
    components: interaction.message.components
  });
}

module.exports = {
  customIdPrefix: 'reg',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;

    if (interaction.isModalSubmit()) {
      if (!String(interaction.customId).startsWith('reg:modalReject:')) return;
      const [, , guildId, regId] = String(interaction.customId).split(':');
      if (guildId !== interaction.guildId || !regId) {
        await interaction.reply({ ephemeral: true, embeds: [errorEmbed({ description: 'Registro inválido.' })] }).catch(() => { });
        return;
      }

      const db = client.db.readGuildDb(interaction.guildId);
      if (!isMemberApprover({ interaction, db })) {
        await interaction.reply({ ephemeral: true, embeds: [errorEmbed({ description: 'Sem permissão para aprovar registros.' })] }).catch(() => { });
        return;
      }

      const pending = db?.registrations?.pending?.[regId];
      if (!pending) {
        await interaction.reply({ ephemeral: true, embeds: [warningEmbed({ description: 'Este registro não está mais pendente.' })] }).catch(() => { });
        return;
      }

      const candidateId = pending.candidateId;
      await interaction.deferReply({ ephemeral: true });
      const reason = interaction.fields.getTextInputValue('reason').trim();
      await client.db.updateGuildDb(interaction.guildId, (db2) => {
        if (db2.registrations?.pending?.[regId]) delete db2.registrations.pending[regId];
      });

      const candidateUser = await client.users.fetch(candidateId).catch(() => null);
      if (db?.config?.dmEnabled && candidateUser) {
        await safeDm(candidateUser, {
          embeds: [errorEmbed({ title: 'Reprovado', description: `Seu registro foi reprovado.\nMotivo: **${reason}**` })]
        });
      }

      await sendGuildLog({
        client,
        guildId: interaction.guildId,
        title: 'Registro reprovado',
        user: interaction.user,
        accent: 'danger',
        fields: [
          { name: '👤 Usuário', value: `<@${candidateId}>`, inline: true },
          { name: 'Motivo', value: reason, inline: false }
        ]
      });

      await interaction.message.edit({
        embeds: [
          errorEmbed({
            title: 'Registro reprovado',
            description: `Por <@${interaction.user.id}>`,
            fields: [{ name: 'Motivo', value: reason, inline: false }]
          })
        ],
        components: []
      });

      await interaction.editReply({
        embeds: [successEmbed({ title: 'Reprovação enviada', description: 'Registro atualizado e DM enviada (se habilitado).' })]
      });
      return;
    }

    const parsed = parseCustomId(interaction.customId);
    const regId = parsed.rest?.[0] ?? '';
    if (!regId) return;

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberApprover({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Sem permissão para aprovar registros.' })] });
    }

    const pending = db?.registrations?.pending?.[regId];
    if (!pending) {
      return safeReply(interaction, { ephemeral: true, embeds: [warningEmbed({ description: 'Este registro não está mais pendente.' })] });
    }

    const candidateId = pending.candidateId;

    if (interaction.isButton()) {
      if (parsed.action === 'approve') {
        await interaction.deferUpdate();
        await applyApproval({ interaction, client, regId, candidateId, data: pending });
        return;
      }

      if (parsed.action === 'pending') {
        await interaction.deferUpdate();
        await applyPending({ interaction });
        return;
      }

      if (parsed.action === 'reject') {
        const modal = new ModalBuilder().setCustomId(`reg:modalReject:${interaction.guildId}:${regId}`).setTitle('Reprovar Registro');
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('Motivo (obrigatório)')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );
        return interaction.showModal(modal);
      }
    }
  }
};
