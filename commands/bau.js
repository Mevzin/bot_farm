const {
  ActionRowBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} = require('discord.js');

const { buildPanelEmbed } = require('../utils/embeds');
const { checkAndSetCooldown } = require('../utils/cooldown');

function itemsMenu(db, customId) {
  const items = Array.isArray(db.items) ? db.items : [];
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Selecione até 5 itens')
    .setMinValues(1)
    .setMaxValues(Math.min(5, Math.max(1, items.length)))
    .addOptions(
      items.slice(0, 25).map((it) => ({
        label: it.name.slice(0, 100),
        description: it.category.slice(0, 100),
        value: it.id
      }))
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bau')
    .setDescription('Gerenciamento do baú')
    .addSubcommand((sc) => sc.setName('guardar').setDescription('Registrar depósito de itens no baú'))
    .addSubcommand((sc) => sc.setName('retirar').setDescription('Registrar retirada de itens do baú (print obrigatória)')),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, content: 'Use este comando dentro de um servidor.' });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: `bau:${interaction.options.getSubcommand()}`,
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, content: `Aguarde ${cooldown}s para usar novamente.` });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    const items = Array.isArray(db.items) ? db.items : [];
    if (!items.length) {
      return safeReply(interaction, { ephemeral: true, content: 'Nenhum item cadastrado. Use /itens para cadastrar.' });
    }

    const mode = interaction.options.getSubcommand() === 'guardar' ? 'deposit' : 'withdraw';

    const embed = buildPanelEmbed({
      title: mode === 'deposit' ? 'Guardar Itens' : 'Retirar Itens',
      description:
        mode === 'deposit'
          ? 'Selecione os itens e informe a quantidade de cada um.'
          : 'Selecione os itens, informe as quantidades e envie print (obrigatória).'
    });

    const menu = itemsMenu(db, `chest:select:${mode}`);
    return safeReply(interaction, {
      ephemeral: true,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)]
    });
  }
};

