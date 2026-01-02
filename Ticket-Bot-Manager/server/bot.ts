import dotenv from 'dotenv';
dotenv.config();

import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  TextChannel,
  EmbedBuilder,
  SelectMenuBuilder,
  SelectMenuOptionBuilder
} from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const CLOSED_CATEGORY_ID = process.env.CLOSED_CATEGORY_ID;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN is not set!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

// Safe interaction call helper
async function safeInteractionCall(interaction: any, fn: 'reply' | 'update' | 'followUp', ...args: any[]) {
  try {
    return await (interaction[fn] as Function)(...args);
  } catch (err: any) {
    if (err && (err.code === 10062 || String(err.message).includes('Unknown interaction'))) return;
    console.error('Interaction error:', err);
  }
}

// Keep track of panel states
const panelStatus: Record<string, boolean> = {
  mod: true,
  supporter: true
};

// Tickets data
interface TicketData {
  type: 'mod' | 'supporter' | 'question' | 'suggestion';
  priority: number;
  creatorId: string;
}
const ticketMap = new Map<string, TicketData>();

// Exported start function
export async function startBot() {
  client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    await client.user?.setPresence({
      activities: [{ name: 'Managing tickets' }],
      status: 'online'
    });

    // Register slash commands
    if (!GUILD_ID) return;
    const guild = client.guilds.cache.get(GUILD_ID);
    const commands = [
      {
        name: 'ticket',
        description: 'Ticket system commands',
        options: [
          {
            type: 1, // subcommand
            name: 'setup',
            description: 'Send the ticket panel'
          },
          {
            type: 1,
            name: 'close',
            description: 'Close applications panel',
            options: [
              { type: 3, name: 'type', description: 'mod or supporter', required: true }
            ]
          },
          {
            type: 1,
            name: 'open',
            description: 'Open applications panel',
            options: [
              { type: 3, name: 'type', description: 'mod or supporter', required: true }
            ]
          }
        ]
      },
      {
        name: 'news',
        description: 'Send news update',
        options: [
          { type: 7, name: 'channel', description: 'Channel to send news', required: true }
        ]
      }
    ];

    await guild?.commands.set(commands);
    console.log(`✅ Commands registered for guild ${GUILD_ID}`);
  });

  // Interaction handler
  client.on('interactionCreate', async (interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;

        if (commandName === 'ticket') {
          const sub = options.getSubcommand(true);

          if (sub === 'setup') {
            // Send main ticket panel
            const modBtn = new ButtonBuilder()
              .setCustomId('ticket_mod')
              .setLabel('Bewerbung Mod')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(!panelStatus.mod);

            const supBtn = new ButtonBuilder()
              .setCustomId('ticket_supporter')
              .setLabel('Bewerbung Supporter')
              .setStyle(ButtonStyle.Success)
              .setDisabled(!panelStatus.supporter);

            const questionBtn = new ButtonBuilder()
              .setCustomId('ticket_question')
              .setLabel('Frage stellen')
              .setStyle(ButtonStyle.Secondary);

            const suggestionBtn = new ButtonBuilder()
              .setCustomId('ticket_suggestion')
              .setLabel('Vorschlag einreichen')
              .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(modBtn, supBtn, questionBtn, suggestionBtn);

            await interaction.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('🎫 Ticket-System')
                  .setDescription('Wähle unten aus, welche Art von Ticket du öffnen möchtest.')
                  .setColor(0x00ff99)
              ],
              components: [row],
              ephemeral: false
            });
          }

          if (sub === 'close') {
            const type = options.getString('type', true);
            panelStatus[type] = false;
            await interaction.reply({ content: `${type} Bewerbungen sind jetzt geschlossen.`, ephemeral: true });
          }

          if (sub === 'open') {
            const type = options.getString('type', true);
            panelStatus[type] = true;
            await interaction.reply({ content: `${type} Bewerbungen sind jetzt geöffnet.`, ephemeral: true });
          }
        }

        if (commandName === 'news') {
          const ch = options.getChannel('channel', true) as TextChannel;
          await ch.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('📰 News Update')
                .setDescription('Hier siehst du die neuesten Updates und Features.')
                .setColor(0xff9900)
            ]
          });
          await interaction.reply({ content: 'News gesendet!', ephemeral: true });
        }
      }

      // Button interactions
      if (interaction.isButton()) {
        const guild = interaction.guild;
        if (!guild) return;

        let type: 'mod' | 'supporter' | 'question' | 'suggestion' = 'question';
        if (interaction.customId === 'ticket_mod') type = 'mod';
        else if (interaction.customId === 'ticket_supporter') type = 'supporter';
        else if (interaction.customId === 'ticket_question') type = 'question';
        else if (interaction.customId === 'ticket_suggestion') type = 'suggestion';

        // Check if panel is closed
        if ((type === 'mod' && !panelStatus.mod) || (type === 'supporter' && !panelStatus.supporter)) {
          await interaction.user.send(`${type} Bewerbungen sind aktuell geschlossen.`);
          await safeInteractionCall(interaction, 'reply', { content: 'Dieses Ticket kann derzeit nicht erstellt werden.', ephemeral: true });
          return;
        }

        const ticketName = `${type}-${interaction.user.username.toLowerCase()}`.slice(0, 90);
        const overwrites = [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
        ];

        const ch = await guild.channels.create({
          name: ticketName,
          type: 0,
          permissionOverwrites: overwrites,
          parent: TICKET_CATEGORY_ID || undefined
        });

        // Initial message depending on type
        let embed = new EmbedBuilder().setColor(0x00ff99);
        if (type === 'mod' || type === 'supporter') {
          embed.setTitle(`🎓 Bewerbung für ${type === 'mod' ? 'Mod' : 'Supporter'}`)
            .setDescription('Bitte beantworte die Fragen im Formular.');

          const modal = new ModalBuilder()
            .setCustomId(`modal_${type}_${interaction.user.id}`)
            .setTitle(`${type === 'mod' ? 'Mod' : 'Supporter'} Bewerbung`);

          const q1 = new TextInputBuilder()
            .setCustomId('q1')
            .setLabel('Warum möchtest du diese Rolle?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const q2 = new TextInputBuilder()
            .setCustomId('q2')
            .setLabel('Warum sollten wir genau dich wählen?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(q1);
          const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(q2);

          modal.addComponents(row1 as any, row2 as any);

          await safeInteractionCall(interaction, 'showModal', modal);
        } else if (type === 'question') {
          embed.setTitle('❓ Neue Frage')
            .setDescription('Stelle hier deine Frage an das Team.');
          await ch.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });
          await safeInteractionCall(interaction, 'reply', { content: `Ticket erstellt: <#${ch.id}>`, ephemeral: true });
        } else if (type === 'suggestion') {
          embed.setTitle('💡 Vorschlag')
            .setDescription('Hier kannst du Vorschläge für Twitch/Discord einreichen.');
          await ch.send({ content: `<@${interaction.user.id}>`, embeds: [embed] });
          await safeInteractionCall(interaction, 'reply', { content: `Ticket erstellt: <#${ch.id}>`, ephemeral: true });
        }

        // Store ticket info
        ticketMap.set(ch.id, { type, priority: 1, creatorId: interaction.user.id });
      }

      // Modal submits
      if (interaction.isModalSubmit()) {
        const [prefix, type, userId] = interaction.customId.split('_');
        const channel = interaction.channel as TextChannel | undefined;
        if (!channel) return;

        const answers = {
          q1: interaction.fields.getTextInputValue('q1'),
          q2: interaction.fields.getTextInputValue('q2')
        };

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Bewerbung von <@${interaction.user.id}>`)
              .setDescription(`**Frage 1:** ${answers.q1}\n**Frage 2:** ${answers.q2}`)
              .setColor(0x00ff99)
          ]
        });

        await safeInteractionCall(interaction, 'reply', { content: 'Deine Bewerbung wurde eingereicht!', ephemeral: true });
      }
    } catch (err) {
      console.error('Interaction error:', err);
      try {
        await safeInteractionCall(interaction, 'reply', { content: 'Ein Fehler ist aufgetreten.', ephemeral: true });
      } catch {}
    }
  });

  await client.login(TOKEN);
  console.log('✅ Discord bot logged in');
}
