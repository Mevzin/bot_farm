# Bot Discord - Baú, Farm e Lavagem de Dinheiro

Projeto em **Node.js** com **Discord.js v14**, modular, com **Slash Commands**, **Modals**, **Select Menus** e **Buttons**, usando **banco local em JSON** com **backup automático** e **logs**.

## Requisitos

- Node.js 18+
- Um Bot criado no Discord Developer Portal com permissões de `applications.commands`

## Instalação

```bash
npm install
```

## Configuração

Edite o arquivo [bot.json](file:///d:/projects/bot%20farm/config/bot.json):

- `token`: token do bot
- `clientId`: Application ID do bot
- `guildId` (opcional): para registrar comandos em um servidor específico (recomendado para testes)
- `backupIntervalMinutes`: intervalo de backup
- `backupRetentionDays`: retenção dos backups

## Registrar Slash Commands

```bash
npm run deploy
```

## Executar

```bash
npm start
```

## Estrutura

- `/commands` comandos slash
- `/events` eventos do Discord
- `/components` handlers de buttons/selects/modals
- `/database` JSON por guild em `/database/guilds` + backups em `/database/backups`
- `/config` configurações locais do bot (não coloque token em repositórios públicos)
- `/utils` utilitários (db, logs, backups, permissões, etc.)
- `/logs` logs em arquivo (JSON lines) por dia

## Comandos principais

- `/configurar` painel para configurar canais e cargos admin
- `/itens` painel administrativo de itens
- `/bau guardar` registrar depósito (print opcional)
- `/bau retirar` registrar retirada (print obrigatória)
- `/dinheirosujo` registrar dinheiro sujo (print obrigatória; lavagem automática 75%)
- `/farm` registrar farm por categoria
- `/membros` painel para cadastro interno de membros

## Permissões

- Defina **Cargo Master** e **Cargo Admin** no `/configurar`
- Se cargos não estiverem configurados, `Administrator` ainda tem acesso aos painéis administrativos

