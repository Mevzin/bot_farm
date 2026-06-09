const { SlashCommandBuilder } = require('discord.js');

const { checkAndSetCooldown } = require('../utils/cooldown');
const { parsePositiveInt, isImageAttachment, normalizeImageUrl } = require('../utils/validate');
const { commitDirtyMoney } = require('../utils/money');
const { errorEmbed, infoEmbed, successEmbed } = require('../utils/embedBuilder');
const { buildDonatePromptEmbed, buildDonateButtons, buildDonateButtonsRow2 } = require('../components/goal');

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dinheirosujo')
    .setDescription('Registrar dinheiro sujo com comprovante')
    .addStringOption((opt) => opt.setName('valor').setDescription('Valor do dinheiro sujo').setRequired(true))
    .addAttachmentOption((opt) => opt.setName('comprovante').setDescription('Imagem de comprovacao'))
    .addStringOption((opt) => opt.setName('link').setDescription('Link direto da imagem')),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Use este comando dentro de um servidor.' })] });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'dinheirosujo',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: `Aguarde ${cooldown}s para usar novamente.` })] });
    }

    const dirtyAdded = parsePositiveInt(interaction.options.getString('valor', true));
    if (!dirtyAdded) {
      return safeReply(interaction, { ephemeral: true, embeds: [errorEmbed({ description: 'Valor inválido. Use apenas números positivos.' })] });
    }

    const attachment = interaction.options.getAttachment('comprovante');
    const link = normalizeImageUrl(interaction.options.getString('link') || '');

    let imageUrl = '';
    if (attachment) {
      if (!isImageAttachment(attachment)) {
        return safeReply(interaction, {
          ephemeral: true,
          embeds: [errorEmbed({ description: 'O comprovante deve ser uma imagem PNG, JPG, JPEG ou WEBP.' })]
        });
      }
      imageUrl = attachment.url;
    }
    if (!imageUrl && link) {
      imageUrl = link;
    }
    if (!imageUrl) {
      return safeReply(interaction, {
        ephemeral: true,
        embeds: [errorEmbed({ description: 'Envie um anexo de imagem ou informe um link válido da comprovacao.' })]
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await commitDirtyMoney({
        client,
        guildId: interaction.guildId,
        user: interaction.user,
        dirtyAdded,
        imageUrl
      });

      const guildDb = client.db.readGuildDb(interaction.guildId);
      const washPercentage = Number(result.washPercentage ?? guildDb?.config?.washPercentage ?? 75);
      if (guildDb?.config?.dmEnabled) {
        await interaction.user.send({
          embeds: [
            infoEmbed({
              title: 'Saldo atualizado',
              description:
                `Total sujo atual: **$${money(result.totals?.dirtyTotal ?? 0)}**\n` +
                `Previsão limpa atual (${washPercentage}%): **$${money(Math.floor((Number(result.totals?.dirtyTotal ?? 0) * washPercentage) / 100))}**`
            })
          ]
        }).catch(() => {});
      }

      const registeredEmbed = successEmbed({
        title: 'Dinheiro sujo registrado',
        description:
          `Valor depositado: **$${money(dirtyAdded)}**\n` +
          `Previsão de lavagem (${washPercentage}%): **$${money(result.cleanAdded)}**\n` +
          `Total sujo atual: **$${money(result.totals?.dirtyTotal ?? 0)}**`
      });

      const goal = guildDb.goal;
      const canOfferDonate =
        guildDb?.config?.donationEnabled !== false &&
        guildDb?.config?.metaEnabled !== false &&
        Number(goal?.target ?? 0) > 0 &&
        Number(goal?.current ?? 0) < Number(goal?.target ?? 0);

      if (!canOfferDonate) {
        await interaction.editReply({ embeds: [registeredEmbed] });
        return;
      }

      const prompt = buildDonatePromptEmbed({ db: guildDb, userId: interaction.user.id, baseAmount: dirtyAdded });
      await interaction.editReply({ embeds: [registeredEmbed] });
      await interaction.followUp({
        ephemeral: true,
        embeds: [prompt],
        components: [
          buildDonateButtons({ guildId: interaction.guildId, userId: interaction.user.id, baseAmount: dirtyAdded }),
          buildDonateButtonsRow2({ guildId: interaction.guildId, userId: interaction.user.id, baseAmount: dirtyAdded })
        ]
      });
    } catch (err) {
      const message = err?.code === 'DUPLICATE' ? 'Registro duplicado detectado. Aguarde um instante e tente novamente.' : 'Falha ao registrar dinheiro sujo.';
      await interaction.editReply({ embeds: [errorEmbed({ description: message })] });
    }
  }
};
