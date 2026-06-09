const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const { parsePositiveInt } = require('../utils/validate');
const { createSession, getSession, clearSession } = require('../utils/sessions');
const { commitChestMovement } = require('../utils/chest');

function resolvePrintChannelId(db, fallbackChannelId) {
  return db?.config?.proofChannelId || db?.config?.registryChannelId || fallbackChannelId || '';
}

function summarizeItems(db, items) {
  const byId = new Map((db.items ?? []).map((x) => [x.id, x]));
  return items
    .map((it) => {
      const name = byId.get(it.itemId)?.name ?? it.itemId;
      return `• ${it.qty}x ${name}`;
    })
    .join('\n');
}

module.exports = {
  customIdPrefix: 'chest',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    const db = client.db.readGuildDb(interaction.guildId);

    const [, action, mode] = String(interaction.customId).split(':');

    if (interaction.isStringSelectMenu()) {
      if (action !== 'select') return;
      const itemIds = interaction.values ?? [];
      if (!itemIds.length) return;

      const modal = new ModalBuilder().setCustomId(`chest:modal:${mode}`).setTitle('Quantidades');
      const items = (db.items ?? []).filter((x) => itemIds.includes(x.id));

      for (const it of items.slice(0, 5)) {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(`q:${it.id}`)
              .setLabel(`${it.name} (qtd)`)
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
      }

      createSession({
        client,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        type: 'chest',
        data: { mode, itemIds },
        ttlMs: 5 * 60_000
      });

      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
      if (action !== 'modal') return;
      const session = getSession({ client, guildId: interaction.guildId, userId: interaction.user.id });
      if (!session || session.type !== 'chest' || session.data.mode !== mode) {
        return safeReply(interaction, { ephemeral: true, content: 'Sessão expirada. Execute o comando novamente.' });
      }

      const itemIds = session.data.itemIds ?? [];
      const items = [];
      for (const itemId of itemIds.slice(0, 5)) {
        const qty = parsePositiveInt(interaction.fields.getTextInputValue(`q:${itemId}`));
        if (!qty) {
          return safeReply(interaction, { ephemeral: true, content: 'Quantidade inválida. Use apenas números positivos.' });
        }
        items.push({ itemId, qty });
      }

      session.data.items = items;
      session.data.printChannelId = resolvePrintChannelId(db, interaction.channelId);

      if (mode === 'withdraw') {
        clearSession({ client, guildId: interaction.guildId, userId: interaction.user.id });
        createSession({
          client,
          guildId: interaction.guildId,
          channelId: session.data.printChannelId,
          userId: interaction.user.id,
          type: 'chest_withdraw_wait_print',
          data: { items, mode },
          ttlMs: 3 * 60_000,
          onAttachment: async ({ message, attachment }) => {
            try {
              await commitChestMovement({
                client,
                guildId: message.guild.id,
                mode,
                user: message.author,
                items,
                imageUrl: attachment.url
              });
              await message.reply({ content: `✅ Retirada registrada.\n${summarizeItems(client.db.readGuildDb(message.guild.id), items)}` });
            } catch (err) {
              await message.reply({ content: '❌ Falha ao registrar retirada. Verifique estoque/duplicação e tente novamente.' });
            }
          }
        });

        const channelText =
          session.data.printChannelId && session.data.printChannelId !== interaction.channelId
            ? `Envie a print no canal <#${session.data.printChannelId}> (somente uma imagem).`
            : 'Envie a print neste canal (somente uma imagem).';

        return safeReply(interaction, {
          ephemeral: true,
          content: `Print obrigatória.\n${channelText}\n\nItens:\n${summarizeItems(db, items)}`
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('chest:finish:deposit').setLabel('Finalizar sem print').setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('chest:waitprint:deposit')
          .setLabel('Enviar print (opcional)')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('chest:cancel').setLabel('Cancelar').setStyle(ButtonStyle.Danger)
      );

      return safeReply(interaction, {
        ephemeral: true,
        content: `Itens selecionados:\n${summarizeItems(db, items)}`,
        components: [row]
      });
    }

    if (interaction.isButton()) {
      if (action === 'cancel') {
        clearSession({ client, guildId: interaction.guildId, userId: interaction.user.id });
        return interaction.update({ content: 'Operação cancelada.', components: [] });
      }

      const session = getSession({ client, guildId: interaction.guildId, userId: interaction.user.id });
      if (!session || session.type !== 'chest') {
        return safeReply(interaction, { ephemeral: true, content: 'Sessão expirada. Execute o comando novamente.' });
      }

      const { items } = session.data;
      if (!Array.isArray(items) || !items.length) {
        return safeReply(interaction, { ephemeral: true, content: 'Itens não encontrados na sessão.' });
      }

      if (action === 'finish') {
        await interaction.deferUpdate();
        clearSession({ client, guildId: interaction.guildId, userId: interaction.user.id });
        try {
          await commitChestMovement({
            client,
            guildId: interaction.guildId,
            mode: 'deposit',
            user: interaction.user,
            items,
            imageUrl: ''
          });
          await interaction.message.edit({ content: '✅ Depósito registrado.', components: [] });
          return;
        } catch (err) {
          await interaction.message.edit({ content: '❌ Falha ao registrar depósito. Tente novamente.', components: [] });
          return;
        }
      }

      if (action === 'waitprint') {
        await interaction.deferUpdate();
        clearSession({ client, guildId: interaction.guildId, userId: interaction.user.id });
        const printChannelId = resolvePrintChannelId(db, interaction.channelId);

        createSession({
          client,
          guildId: interaction.guildId,
          channelId: printChannelId,
          userId: interaction.user.id,
          type: 'chest_deposit_wait_print',
          data: { items, mode: 'deposit' },
          ttlMs: 3 * 60_000,
          onAttachment: async ({ message, attachment }) => {
            try {
              await commitChestMovement({
                client,
                guildId: message.guild.id,
                mode: 'deposit',
                user: message.author,
                items,
                imageUrl: attachment.url
              });
              await message.reply({ content: `✅ Depósito registrado.\n${summarizeItems(client.db.readGuildDb(message.guild.id), items)}` });
            } catch (err) {
              await message.reply({ content: '❌ Falha ao registrar depósito. Tente novamente.' });
            }
          }
        });

        const channelText =
          printChannelId && printChannelId !== interaction.channelId
            ? `Envie a print no canal <#${printChannelId}> (somente uma imagem).`
            : 'Envie a print neste canal (somente uma imagem).';

        await interaction.message.edit({ content: `Aguardando print (opcional).\n${channelText}`, components: [] });
        return;
      }
    }

    return safeReply(interaction, { ephemeral: true, content: 'Ação não reconhecida.' });
  }
};
