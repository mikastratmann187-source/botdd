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
  TextChannel, 
  ChatInputCommandInteraction, 
  ButtonInteraction, 
  ModalSubmitInteraction 
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config(); // Lädt lokale .env, Render liest Environment Variables automatisch

// ----------------------
// ENVIRONMENT VARIABLES
// ----------------------
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; 
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID; 
const CLOSED_CATEGORY_ID = process.env.CLOSED_CATEGORY_ID;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN ist nicht gesetzt! Bitte in Render Environment Variables eintragen.');
  process.exit(1);
}

// ----------------------
// CLIENT INIT
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

// ----------------------
// HELPER: safeInteractionCall
// ----------------------
async function safeInteractionCall(interaction: any, fn: 'reply' | 'update' | 'followUp', ...args: any[]) {
  try {
    return await (interaction[fn] as Function)(...args);
  } catch (err: any) {
    if (err && (err.code === 10062 || String(err.message).includes('Unknown interaction'))) return;
    console.error('Interaction error:', err);
  }
}

// ----------------------
// CLIENT READY
// ----------------------
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);

  // Set presence
  try {
    await client.user?.setPresence({
      activities: [{ name: 'Managing tickets' }],
      status: 'online',
    });
  } catch (err) {
    console.warn('Failed to set presence:', err);
  }

  // Register slash commands
  const commands = [
    { name: 'open-ticket', description: 'Open a new support ticket' },
  ];

  try {
    if (GUILD_ID && client.application?.owner) {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (guild) {
        await guild.commands.set(commands);
        console.log(`✅ Registered commands to guild ${GUILD_ID}`);
      } else {
        await client.application?.commands.set(commands, GUILD_ID);
        console.log(`✅ Registered commands to guild ${GUILD_ID} (via API)`);
      }
    } else {
      await client.application?.commands.set(commands);
      console.log('✅ Registered global commands');
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

// ----------------------
// INTERACTION HANDLER
// ----------------------
client.on('interactionCreate', async (interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction) => {
  try {
    // ----------------------
    // SLASH COMMAND: /open-ticket
    // ----------------------
    if ('isChatInputCommand' in interaction && interaction.isChatInputCommand()) {
      if (interaction.commandName === 'open-ticket') {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        const guild = interaction.guild;
        if (!guild) {
          await safeInteractionCall(interaction, 'reply', { content: 'This command can only be used in a server.', ephemeral: true });
          return;
        }

        const name = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`.slice(0, 90);

        const overwrites = [
          { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
          { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels] },
        ];

        const channelOptions: any = { type: 0, permissionOverwrites: overwrites };
        if (TICKET_CATEGORY_ID) channelOptions.parent = TICKET_CATEGORY_ID;

        const channel = await guild.channels.create({ name, ...channelOptions });

        const closeButton = new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

        await channel.send({ content: `Hello <@${interaction.user.id}>, a staff member will be with you shortly. Use the button below to close this ticket when you are done.`, components: [row] });

        await safeInteractionCall(interaction, 'editReply', { content: `Ticket created: <#${channel.id}>`, ephemeral: true }).catch(() => {});
        return;
      }
    }

    // ----------------------
    // BUTTON INTERACTIONS
    // ----------------------
    if ('isButton' in interaction && interaction.isButton()) {
      if (interaction.customId === 'ticket_close') {
        const modal = new ModalBuilder().setCustomId('ticket_close_modal').setTitle('Close Ticket');

        const reasonInput = new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason for closing (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setPlaceholder('Describe why the ticket is being closed');

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
        modal.addComponents(firstRow as any);

        await interaction.showModal(modal).catch(async (err: any) => {
          if (err && (err.code === 10062 || String(err.message).includes('Unknown interaction'))) return;
          console.error('showModal failed:', err);
          await safeInteractionCall(interaction, 'reply', { content: 'Failed to open modal to close ticket.', ephemeral: true });
        });
        return;
      }
    }

    // ----------------------
    // MODAL SUBMIT
    // ----------------------
    if ('isModalSubmit' in interaction && interaction.isModalSubmit()) {
      if (interaction.customId === 'ticket_close_modal') {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
        const channel = interaction.channel as TextChannel | undefined;
        if (!channel || !channel.guild) {
          await safeInteractionCall(interaction, 'editReply', { content: 'Could not determine ticket channel.', ephemeral: true });
          return;
        }

        try {
          // Move to closed category
          if (CLOSED_CATEGORY_ID) {
            await channel.setParent(CLOSED_CATEGORY_ID).catch(err => console.warn('Failed to move channel to closed category:', err));
          }

          await channel.setName(`closed-${channel.name}`).catch(err => console.warn('Failed to rename channel:', err));
          await channel.send(`This ticket has been closed by <@${interaction.user.id}>. Reason: ${reason}`);
          await safeInteractionCall(interaction, 'editReply', { content: 'Ticket closed successfully.', ephemeral: true });
        } catch (err) {
          console.error('Error closing ticket:', err);
          await safeInteractionCall(interaction, 'editReply', { content: 'An error occurred while closing the ticket.', ephemeral: true });
        }
        return;
      }
    }
  } catch (err) {
    console.error('Unhandled interaction error:', err);
    try {
      await safeInteractionCall(interaction, 'reply', { content: 'An unexpected error occurred.', ephemeral: true });
    } catch {}
  }
});

// ----------------------
// LOGIN
// ----------------------
client.login(TOKEN).catch(err => {
  console.error('❌ Failed to login:', err);
  process.exit(1);
});


