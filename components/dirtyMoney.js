const { createSession } = require('../utils/sessions');
const { parsePositiveInt } = require('../utils/validate');
const { commitDirtyMoney } = require('../utils/money');
const { getWashPercentage } = require('../utils/financeSettings');
const { infoEmbed, successEmbed } = require('../utils/embedBuilder');
const { buildDonatePromptEmbed, buildDonateButtons, buildDonateButtonsRow2 } = require('./goal');

function resolvePrintChannelId(db, fallbackChannelId) {
  return db?.config?.proofChannelId || db?.config?.financeChannelId || db?.config?.registryChannelId || fallbackChannelId || '';
}

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
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

    const washPercentage = getWashPercentage(db);
    const cleanAdded = Math.floor((dirtyAdded * washPercentage) / 100);
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
          if (guildDb?.config?.dmEnabled) {
            const currentWash = getWashPercentage(guildDb);
            const dmEmbed = infoEmbed({
              title: 'Saldo atualizado',
              description:
                `Total sujo atual: **$${money(result.totals?.dirtyTotal ?? 0)}**\n` +
                `Previsão limpa atual (${currentWash}%): **$${money(Math.floor((Number(result.totals?.dirtyTotal ?? 0) * currentWash) / 100))}**`
            });
            await message.author.send({ embeds: [dmEmbed] }).catch(() => { });
          }
          const goal = guildDb.goal;
          const canOfferDonate =
            guildDb?.config?.donationEnabled !== false &&
            guildDb?.config?.metaEnabled !== false &&
            Number(goal?.target ?? 0) > 0 &&
            Number(goal?.current ?? 0) < Number(goal?.target ?? 0);
          const currentWash = getWashPercentage(guildDb);

          const registeredEmbed = successEmbed({
            title: 'Dinheiro sujo registrado',
            description:
              `Sujo: **$${money(dirtyAdded)}**\n` +
              `Limpo (${currentWash}%): **$${money(result.cleanAdded)}**\n` +
              `Total sujo: **$${money(result.totals?.dirtyTotal ?? 0)}**\n` +
              `Previsão limpa atual: **$${money(Math.floor((Number(result.totals?.dirtyTotal ?? 0) * currentWash) / 100))}**`
          });

          if (!canOfferDonate) {
            await message.reply({ embeds: [registeredEmbed] });
            return;
          }

          const prompt = buildDonatePromptEmbed({ db: guildDb, userId: message.author.id, baseAmount: dirtyAdded });

          await message.reply({
            embeds: [registeredEmbed, prompt],
            components: [
              buildDonateButtons({ guildId: message.guild.id, userId: message.author.id, baseAmount: dirtyAdded }),
              buildDonateButtonsRow2({ guildId: message.guild.id, userId: message.author.id, baseAmount: dirtyAdded })
            ]
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
        `Lavagem automática (${washPercentage}%): **${cleanAdded.toLocaleString('pt-BR')}**\n\n` +
        `Print obrigatória.\n${channelText}`
    });
  }
};
