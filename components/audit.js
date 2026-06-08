const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const { createSession, getSession } = require('../utils/sessions');
const { infoEmbed, warningEmbed, errorEmbed } = require('../utils/embedBuilder');
const { isMemberAdmin } = require('../utils/permissions');
const { createCustomId, parseCustomId, assertCustomIdOwner } = require('../utils/customId');

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

function pageButtons({ guildId, userId, page }) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'audit', action: 'prev', guildId, userId, extra: [String(page)] }))
      .setLabel('⬅️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'audit', action: 'next', guildId, userId, extra: [String(page)] }))
      .setLabel('➡️')
      .setStyle(ButtonStyle.Secondary)
  );
}

function collectEntries(db, type, filterUserId) {
  if (type === 'deposit' || type === 'withdraw') {
    const list = db?.chest?.movements ?? [];
    const filtered = list.filter((m) => m.type === type && (!filterUserId || m.userId === filterUserId));
    return filtered
      .slice()
      .reverse()
      .map((m) => ({
        id: m.id,
        userId: m.userId,
        createdAt: m.createdAt,
        summary: (m.items ?? []).map((it) => `${it.qty}x ${it.itemId}`).join(', ').slice(0, 150),
        imageUrl: m.imageUrl || ''
      }));
  }

  if (type === 'wash') {
    const list = db?.washes?.records ?? [];
    const filtered = list.filter((r) => (!filterUserId || r.userId === filterUserId));
    return filtered
      .slice()
      .reverse()
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        createdAt: r.createdAt,
        summary: `Lavado: $${money(r.dirtyAmount)} → Limpo: $${money(r.cleanAmount)} | Admin: <@${r.adminId}>`,
        imageUrl: ''
      }));
  }

  if (type === 'donation') {
    const list = db?.goal?.contributions ?? [];
    const filtered = list.filter((r) => (!filterUserId || r.userId === filterUserId));
    return filtered
      .slice()
      .reverse()
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        createdAt: r.createdAt,
        summary: `Doou: $${money(r.amount)}`,
        imageUrl: ''
      }));
  }

  return [];
}

function renderAuditEmbed({ type, filterUserId, page, pageSize, entries }) {
  const start = page * pageSize;
  const chunk = entries.slice(start, start + pageSize);
  const typeLabel =
    type === 'deposit' ? 'Depósitos' : type === 'withdraw' ? 'Retiradas' : type === 'wash' ? 'Lavagens' : 'Doações';

  const lines = chunk.map((e) => {
    return `• <@${e.userId}> — ${e.summary}\nID: \`${e.id}\`\nData: \`${String(e.createdAt).replace('T', ' ').slice(0, 19)}\``;
  });

  return infoEmbed({
    title: `Auditoria - ${typeLabel}`,
    description:
      `${filterUserId ? `Filtro: <@${filterUserId}>\n` : ''}` +
      `Página: **${page + 1}**\n\n` +
      (lines.join('\n\n') || 'Sem registros.')
  });
}

module.exports = {
  customIdPrefix: 'audit',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberAdmin({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Sem permissão.' })] });
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId !== 'audit:setType') return;
      const type = interaction.values?.[0] ?? 'deposit';
      createSession({
        client,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        type: 'audit',
        data: { type, filterUserId: null, page: 0 },
        ttlMs: 10 * 60_000
      });
      const db2 = client.db.readGuildDb(interaction.guildId);
      const entries = collectEntries(db2, type, null);
      const embed = renderAuditEmbed({ type, filterUserId: null, page: 0, pageSize: 5, entries });
      const rows = interaction.message.components.slice(0, 2);
      return interaction.update({ embeds: [embed], components: [...rows, pageButtons({ guildId: interaction.guildId, userId: interaction.user.id, page: 0 })] });
    }

    if (interaction.isUserSelectMenu()) {
      if (interaction.customId !== 'audit:setUser') return;
      const selected = interaction.values?.[0] ?? null;
      const session = getSession({ client, guildId: interaction.guildId, userId: interaction.user.id });
      const type = session?.type === 'audit' ? session.data.type : 'deposit';
      createSession({
        client,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        type: 'audit',
        data: { type, filterUserId: selected, page: 0 },
        ttlMs: 10 * 60_000
      });
      const db2 = client.db.readGuildDb(interaction.guildId);
      const entries = collectEntries(db2, type, selected);
      const embed = renderAuditEmbed({ type, filterUserId: selected, page: 0, pageSize: 5, entries });
      const rows = interaction.message.components.slice(0, 2);
      return interaction.update({ embeds: [embed], components: [...rows, pageButtons({ guildId: interaction.guildId, userId: interaction.user.id, page: 0 })] });
    }

    if (interaction.isButton()) {
      const parsed = parseCustomId(interaction.customId);
      if (!assertCustomIdOwner({ interaction, parsed })) {
        return safeReply(interaction, { ephemeral: true, embeds: [warningEmbed({ description: 'Este painel não é seu.' })] });
      }

      const session = getSession({ client, guildId: interaction.guildId, userId: interaction.user.id });
      if (!session || session.type !== 'audit') {
        return safeReply(interaction, { ephemeral: true, embeds: [warningEmbed({ description: 'Sessão expirada. Use /auditoria novamente.' })] });
      }

      const currentPage = Number(session.data.page ?? 0);
      const type = session.data.type ?? 'deposit';
      const filterUserId = session.data.filterUserId ?? null;

      const db2 = client.db.readGuildDb(interaction.guildId);
      const entries = collectEntries(db2, type, filterUserId);
      const maxPage = Math.max(0, Math.ceil(entries.length / 5) - 1);

      const nextPage =
        parsed.action === 'next' ? Math.min(maxPage, currentPage + 1) : parsed.action === 'prev' ? Math.max(0, currentPage - 1) : currentPage;

      createSession({
        client,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        type: 'audit',
        data: { type, filterUserId, page: nextPage },
        ttlMs: 10 * 60_000
      });

      await interaction.deferUpdate();
      const embed = renderAuditEmbed({ type, filterUserId, page: nextPage, pageSize: 5, entries });
      await interaction.message.edit({ embeds: [embed], components: [...interaction.message.components.slice(0, 2), pageButtons({ guildId: interaction.guildId, userId: interaction.user.id, page: nextPage })] });
      return;
    }
  }
};
