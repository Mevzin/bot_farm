const { createSession } = require('../utils/sessions');
const { parsePositiveInt } = require('../utils/validate');
const { commitDirtyMoney } = require('../utils/money');
const { infoEmbed, successEmbed } = require('../utils/embedBuilder');
const { createCustomId } = require('../utils/customId');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function resolvePrintChannelId(db, fallbackChannelId) {
  return db?.config?.registryChannelId || fallbackChannelId || '';
}

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

function donateRows({ guildId, userId }) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'donate10', guildId, userId }))
      .setLabel('Doar 10%')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'donate25', guildId, userId }))
      .setLabel('Doar 25%')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'donate50', guildId, userId }))
      .setLabel('Doar 50%')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'custom', guildId, userId }))
      .setLabel('Personalizado')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(createCustomId({ prefix: 'goal', action: 'cancel', guildId, userId }))
      .setLabel('Cancelar')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

module.exports = {
  customIdPrefix: 'dm',
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) return;
    if (!interaction.isModalSubmit()) return;

    const db = client.db.readGuildDb(interaction.guildId);
    const dirtyAdded = parsePositiveInt(interaction.fields.getTextInputValue('value'));
    if (!dirtyAdded) {
      return safeReply(interaction, { ephemeral: true, content: 'Valor inválido. Use apenas números positivos.' });
    }

    const cleanAdded = Math.floor(dirtyAdded * 0.75);
    const printChannelId = resolvePrintChannelId(db, interaction.channelId);

    createSession({
      client,
      guildId: interaction.guildId,
      channelId: printChannelId,
      userId: interaction.user.id,
      type: 'dirty_money_wait_print',
      data: { dirtyAdded },
      ttlMs: 3 * 60_000,
      onAttachment: async ({ message, attachment }) => {
        try {
          const result = await commitDirtyMoney({
            client,
            guildId: message.guild.id,
            user: message.author,
            dirtyAdded,
            imageUrl: attachment.url
          });
          const guildDb = client.db.readGuildDb(message.guild.id);
          const goal = guildDb.goal;
          const canOfferDonate = Number(goal?.target ?? 0) > 0 && Number(goal?.current ?? 0) < Number(goal?.target ?? 0);

          const registeredEmbed = successEmbed({
            title: 'Dinheiro sujo registrado',
            description:
              `Sujo: **$${money(dirtyAdded)}**\n` +
              `Limpo (75%): **$${money(result.cleanAdded)}**\n` +
              `Total sujo: **$${money(result.totals?.dirtyTotal ?? 0)}**`
          });

          if (!canOfferDonate) {
            await message.reply({ embeds: [registeredEmbed] });
            return;
          }

          const missing = Math.max(0, Number(goal.target) - Number(goal.current));
          const pct = goal.target ? Math.min(100, Math.floor((Number(goal.current) / Number(goal.target)) * 100)) : 0;
          const prompt = infoEmbed({
            title: 'Deseja contribuir para a facção?',
            description:
              `Saldo atual: **$${money(result.totals?.dirtyTotal ?? 0)}**\n` +
              `Meta: **$${money(goal.target)}** | Falta: **$${money(missing)}** | Concluída: **${pct}%**`
          });

          await message.reply({
            embeds: [registeredEmbed, prompt],
            components: donateRows({ guildId: message.guild.id, userId: message.author.id })
          });
        } catch (err) {
          await message.reply({ content: '❌ Falha ao registrar. Tente novamente.' });
        }
      }
    });

    const channelText =
      printChannelId && printChannelId !== interaction.channelId
        ? `Envie a print no canal <#${printChannelId}> (somente uma imagem).`
        : 'Envie a print neste canal (somente uma imagem).';

    return safeReply(interaction, {
      ephemeral: true,
      content:
        `Valor informado: **${dirtyAdded.toLocaleString('pt-BR')}**\n` +
        `Lavagem automática (75%): **${cleanAdded.toLocaleString('pt-BR')}**\n\n` +
        `Print obrigatória.\n${channelText}`
    });
  }
};
