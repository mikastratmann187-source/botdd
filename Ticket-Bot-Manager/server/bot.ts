import dotenv from 'dotenv';
dotenv.config();

const token = process.env.TOKEN;
if (!token) {
  console.error("TOKEN is not set in environment");
  process.exit(1);
}

// Dann login
client.login(token);
import { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // optional: if set, commands will be registered to this guild only
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID; // optional: category to create tickets under
const CLOSED_CATEGORY_ID = process.env.CLOSED_CATEGORY_ID; // optional: category to move closed tickets to

if (!TOKEN) {
  console.error('TOKEN is not set in environment');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
});

// Helper to safely reply/update interactions and ignore Unknown Interaction errors
async function safeInteractionCall(interaction: any, fn: 'reply' | 'update' | 'followUp', ...args: any[]) {
  try {
    // @ts-ignore
    return await (interaction[fn] as Function)(...args);
  } catch (err: any) {
    // Discord "Unknown interaction" errors can happen if an interaction token expires or was already responded to.
    // Error code 10062 is Unknown Interaction — ignore silently in that case.
    if (err && (err.code === 10062 || String(err.message).includes('Unknown interaction'))) {
      return;
    }
    console.error('Interaction error:', err);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // Set a presence so the bot looks alive
  try {
    await client.user?.setPresence({
      activities: [{ name: 'Managing tickets' }],
      status: 'online',
    });
  } catch (err) {
    console.warn('Failed to set presence:', err);
  }

  // Register commands. If GUILD_ID is set, register to that guild for faster updates in dev.
  const commands = [
    {
      name: 'open-ticket',
      description: 'Open a new support ticket',
    },
  ];

  try {
    if (GUILD_ID && client.application?.owner) {
      // Register to a specific guild
      const guild = client.guilds.cache.get(GUILD_ID);
      if (guild) {
        await guild.commands.set(commands);
        console.log(`Registered commands to guild ${GUILD_ID}`);
      } else {
        // If guild is not cached yet, fallback to application command registration for guild via REST
        await client.application?.commands.set(commands, GUILD_ID);
        console.log(`Registered commands to guild ${GUILD_ID} (via application API)`);
      }
    } else {
      await client.application?.commands.set(commands);
      console.log('Registered global commands');
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
});

client.on('interactionCreate', async (interaction: any) => {
  try {
    // Slash command: /open-ticket
    if (interaction.isChatInputCommand && interaction.isChatInputCommand()) {
      if (interaction.commandName === 'open-ticket') {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        const guild = interaction.guild;
        if (!guild) {
          await safeInteractionCall(interaction, 'reply', { content: 'This command can only be used in a server.', ephemeral: true });
          return;
        }

        // Build a safe channel name
        const name = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '')}`.slice(0, 90);

        // Permission overwrites: hide from everyone, allow the user and the bot
        const overwrites = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
          },
          {
            id: client.user!.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels],
          },
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

    // Button interactions
    if (interaction.isButton && interaction.isButton()) {
      const customId = interaction.customId;

      if (customId === 'ticket_close') {
        // Show a modal to collect close reason
        const modal = new ModalBuilder().setCustomId('ticket_close_modal').setTitle('Close Ticket');

        const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason for closing (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Describe why the ticket is being closed');

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
        modal.addComponents(firstRow as any);

        // showModal will acknowledge the interaction; after showing a modal we must return and not attempt to reply/update further
        await interaction.showModal(modal).catch(async (err: any) => {
          // If showing a modal failed, try to fallback to a confirmation reply
          if (err && (err.code === 10062 || String(err.message).includes('Unknown interaction'))) return;
          console.error('showModal failed:', err);
          await safeInteractionCall(interaction, 'reply', { content: 'Failed to open modal to close ticket.', ephemeral: true });
        });

        return; // Important: return after showModal
      }

      // Add other button handlers here if needed
    }

    // Modal submit
    if (interaction.isModalSubmit && interaction.isModalSubmit()) {
      if (interaction.customId === 'ticket_close_modal') {
        // Defer the reply because we will perform potentially long operations (e.g., moving channel, sending messages)
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
        const channel = interaction.channel as TextChannel | undefined;
        if (!channel || !channel.guild) {
          await safeInteractionCall(interaction, 'editReply', { content: 'Could not determine ticket channel.', ephemeral: true });
          return;
        }

        // Update channel: rename and remove send permissions for the original opener
        try {
          // Make channel read-only for non-staff by removing SEND_MESSAGES for everyone except staff and bot
          // Implementation depends on your staff role setup. Here we simply lock the channel for the original opener.
          const openerId = (await channel.permissionOverwrites.fetch()).filter(o => o.type === 'member').firstKey?.();

          // Optionally move to closed category
          if (CLOSED_CATEGORY_ID) {
            await channel.setParent(CLOSED_CATEGORY_ID).catch(err => console.warn('Failed to move channel to closed category:', err));
          }

          // Rename to indicate closed
          await channel.setName(`closed-${channel.name}`).catch(err => console.warn('Failed to rename channel:', err));

          // Send a closing message
          await channel.send(`This ticket has been closed by <@${interaction.user.id}>. Reason: ${reason}`);

          // Acknowledge the modal submit to the user
          await safeInteractionCall(interaction, 'editReply', { content: 'Ticket closed successfully.', ephemeral: true });
        } catch (err) {
          console.error('Error closing ticket:', err);
          await safeInteractionCall(interaction, 'editReply', { content: 'An error occurred while closing the ticket.', ephemeral: true });
        }

        return;
      }
    }
  } catch (err) {
    console.error('Unhandled interaction handler error:', err);
    try {
      await safeInteractionCall(interaction, 'reply', { content: 'An unexpected error occurred.', ephemeral: true });
    } catch {}
  }
});

client.login(TOKEN).catch(err => {
  console.error('Failed to login:', err);
  process.exit(1);
});
