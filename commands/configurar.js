const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder
} = require('discord.js');

const { buildPanelEmbed } = require('../utils/embeds');
const { isMemberMaster, getConfiguredRoleIds } = require('../utils/permissions');
const { checkAndSetCooldown } = require('../utils/cooldown');

function money(n) {
  return Number(n ?? 0).toLocaleString('pt-BR');
}

function toggleStyle(enabled) {
  return enabled ? ButtonStyle.Success : ButtonStyle.Danger;
}

function mainRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:panel:roles').setLabel('Configurar Cargos').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg:panel:channels').setLabel('Configurar Canais').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:panel:system').setLabel('Configurar Sistema').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cfg:panel:finance').setLabel('Configurar Financeiro').setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg:close').setLabel('Fechar').setStyle(ButtonStyle.Danger)
    )
  ];
}

function backRows() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cfg:back').setLabel('Voltar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cfg:close').setLabel('Fechar').setStyle(ButtonStyle.Danger)
  );
}

function renderMainPanel(db) {
  return {
    embeds: [
      buildPanelEmbed({
        title: 'Painel de Configuração',
        description: 'Selecione a categoria que deseja configurar.',
        fields: [
          { name: 'Cargos', value: 'Lider, Administracao, Gerencia, Membro e Recrutador.', inline: false },
          { name: 'Canais', value: 'Logs, Registro, Ranking, Compras, Vendas, Financeiro e Bau.', inline: false },
          { name: 'Sistema', value: 'Metas, Doacao, Ranking, Registro, Logs automáticas e mensagens privadas.', inline: false },
          { name: 'Financeiro', value: 'Lavagem, venda, meta da facção e caixa da facção.', inline: false }
        ]
      })
    ],
    components: mainRows()
  };
}

function renderRolesPanel(db) {
  const roles = getConfiguredRoleIds(db);
  return {
    embeds: [
      buildPanelEmbed({
        title: 'Configurar Cargos',
        description: 'Defina os cargos principais do sistema.',
        fields: [
          { name: 'Cargo Lider', value: roles.leader ? `<@&${roles.leader}>` : 'Nao configurado', inline: true },
          { name: 'Cargo Administracao', value: roles.administration ? `<@&${roles.administration}>` : 'Nao configurado', inline: true },
          { name: 'Cargo Gerencia', value: roles.management ? `<@&${roles.management}>` : 'Nao configurado', inline: true },
          { name: 'Cargo Membro', value: roles.member ? `<@&${roles.member}>` : 'Nao configurado', inline: true },
          { name: 'Cargo Recrutador', value: roles.recruiter ? `<@&${roles.recruiter}>` : 'Nao configurado', inline: true }
        ]
      })
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg:role:leader').setLabel('Cargo Lider').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfg:role:administration').setLabel('Cargo Administracao').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfg:role:management').setLabel('Cargo Gerencia').setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg:role:member').setLabel('Cargo Membro').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfg:role:recruiter').setLabel('Cargo Recrutador').setStyle(ButtonStyle.Secondary)
      ),
      backRows()
    ]
  };
}

function renderChannelsPanel(db) {
  const c = db.config;
  return {
    embeds: [
      buildPanelEmbed({
        title: 'Configurar Canais',
        description: 'Defina os canais separados por categoria.',
        fields: [
          { name: 'Canal Logs Gerais', value: c.logChannelId ? `<#${c.logChannelId}>` : 'Nao configurado', inline: true },
          { name: 'Canal Registro', value: c.registrationChannelId ? `<#${c.registrationChannelId}>` : 'Nao configurado', inline: true },
          { name: 'Canal Ranking', value: c.rankingChannelId ? `<#${c.rankingChannelId}>` : 'Nao configurado', inline: true },
          { name: 'Canal Compras', value: c.purchaseLogChannelId ? `<#${c.purchaseLogChannelId}>` : 'Nao configurado', inline: true },
          { name: 'Canal Vendas', value: c.salesLogChannelId ? `<#${c.salesLogChannelId}>` : 'Nao configurado', inline: true },
          { name: 'Canal Financeiro', value: c.financeChannelId ? `<#${c.financeChannelId}>` : 'Nao configurado', inline: true },
          { name: 'Canal Bau', value: c.chestChannelId ? `<#${c.chestChannelId}>` : 'Nao configurado', inline: true }
        ]
      })
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg:channel:logs').setLabel('Logs Gerais').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg:channel:registration').setLabel('Registro').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg:channel:ranking').setLabel('Ranking').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg:channel:purchases').setLabel('Compras').setStyle(ButtonStyle.Primary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg:channel:sales').setLabel('Vendas').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg:channel:finance').setLabel('Financeiro').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg:channel:chest').setLabel('Bau').setStyle(ButtonStyle.Primary)
      ),
      backRows()
    ]
  };
}

function renderSystemPanel(db) {
  const c = db.config;
  return {
    embeds: [
      buildPanelEmbed({
        title: 'Configurar Sistema',
        description: 'Ative ou desative os módulos do bot.',
        fields: [
          { name: 'Sistema de Metas', value: c.metaEnabled ? 'Ativo' : 'Desativado', inline: true },
          { name: 'Sistema de Doacao', value: c.donationEnabled ? 'Ativo' : 'Desativado', inline: true },
          { name: 'Sistema de Ranking', value: c.rankingEnabled ? 'Ativo' : 'Desativado', inline: true },
          { name: 'Sistema de Registro', value: c.registrationEnabled ? 'Ativo' : 'Desativado', inline: true },
          { name: 'Logs Automaticas', value: c.logsEnabled ? 'Ativo' : 'Desativado', inline: true },
          { name: 'Mensagens Privadas', value: c.dmEnabled ? 'Ativo' : 'Desativado', inline: true }
        ]
      })
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg:toggle:meta').setLabel('Sistema de Metas').setStyle(toggleStyle(c.metaEnabled)),
        new ButtonBuilder().setCustomId('cfg:toggle:donation').setLabel('Sistema de Doacao').setStyle(toggleStyle(c.donationEnabled)),
        new ButtonBuilder().setCustomId('cfg:toggle:ranking').setLabel('Sistema de Ranking').setStyle(toggleStyle(c.rankingEnabled))
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg:toggle:registration').setLabel('Sistema de Registro').setStyle(toggleStyle(c.registrationEnabled)),
        new ButtonBuilder().setCustomId('cfg:toggle:logs').setLabel('Logs Automaticas').setStyle(toggleStyle(c.logsEnabled)),
        new ButtonBuilder().setCustomId('cfg:toggle:dm').setLabel('Mensagens Privadas').setStyle(toggleStyle(c.dmEnabled))
      ),
      backRows()
    ]
  };
}

function renderFinancePanel(db) {
  const c = db.config;
  return {
    embeds: [
      buildPanelEmbed({
        title: 'Configurar Financeiro',
        description: 'Ajuste percentuais e valores-base do financeiro.',
        fields: [
          { name: 'Porcentagem de Lavagem', value: `${Number(c.washPercentage ?? 75)}%`, inline: true },
          { name: 'Porcentagem do Vendedor', value: `${Number(c.salePercentage ?? 30)}%`, inline: true },
          { name: 'Meta da Faccao', value: `$${money(db.goal?.target ?? 0)}`, inline: true },
          { name: 'Caixa da Faccao', value: `$${money(c.factionBalance ?? 0)}`, inline: true }
        ]
      })
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg:finance:wash').setLabel('Porcentagem Lavagem').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfg:finance:sale').setLabel('Porcentagem Venda').setStyle(ButtonStyle.Primary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg:finance:goal').setLabel('Meta da Faccao').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cfg:finance:cash').setLabel('Caixa da Faccao').setStyle(ButtonStyle.Success)
      ),
      backRows()
    ]
  };
}

function renderPanel(panel, db) {
  if (panel === 'roles') return renderRolesPanel(db);
  if (panel === 'channels') return renderChannelsPanel(db);
  if (panel === 'system') return renderSystemPanel(db);
  if (panel === 'finance') return renderFinancePanel(db);
  return renderMainPanel(db);
}

module.exports = {
  data: new SlashCommandBuilder().setName('configurar').setDescription('Abrir painel de configuração do bot'),
  async execute(interaction, { client, safeReply }) {
    if (!interaction.inGuild()) {
      return safeReply(interaction, { ephemeral: true, content: 'Use este comando dentro de um servidor.' });
    }

    const cooldown = checkAndSetCooldown({
      client,
      key: 'configurar',
      userId: interaction.user.id,
      seconds: client.botConfig.defaultCooldownSeconds
    });
    if (cooldown) {
      return safeReply(interaction, { ephemeral: true, content: `Aguarde ${cooldown}s para usar novamente.` });
    }

    const db = client.db.readGuildDb(interaction.guildId);
    if (!isMemberMaster({ interaction, db })) {
      return safeReply(interaction, { ephemeral: true, content: 'Somente o cargo Master pode configurar o bot.' });
    }

    return safeReply(interaction, {
      ephemeral: true,
      ...renderPanel('main', db)
    });
  },
  renderPanel
};
