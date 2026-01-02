import { Client, GatewayIntentBits, PermissionsBitField, TextChannel, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, InteractionCollector, Collection } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID; // Optional
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const CLOSED_CATEGORY_ID = process.env.CLOSED_CATEGORY_ID;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN fehlt!');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
});

interface TicketData {
  userId: string;
  type: string;
  priority: number;
  channelId: string;
}

const tickets = new Collection<string, TicketData>();
const panelsStatus = {
  mod: true,
  supporter: true,
};

client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user?.tag}`);
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;

  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  const [command, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);

  // ------------------------
  // Ticket Setup Panel
  // ------------------------
  if (command === 'ticket' && args[0] === 'setup') {
    const embed = new MessageEmbed()
      .setTitle('🎫 Ticket Panel')
      .setDescription('Wähle deinen Ticket-Typ aus:\n\n• Mod-Bewerbung\n• Supporter-Bewerbung\n• Frage\n• Vorschlag')
      .setColor('BLUE');

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId('ticket_mod')
          .setLabel('Mod Bewerbung')
          .setStyle('PRIMARY')
          .setDisabled(!panelsStatus.mod),
        new MessageButton()
          .setCustomId('ticket_supporter')
          .setLabel('Supporter Bewerbung')
          .setStyle('PRIMARY')
          .setDisabled(!panelsStatus.supporter),
        new MessageButton()
          .setCustomId('ticket_frage')
          .setLabel('Frage')
          .setStyle('SECONDARY'),
        new MessageButton()
          .setCustomId('ticket_vorschlag')
          .setLabel('Vorschlag')
          .setStyle('SUCCESS')
      );

    await message.channel.send({ embeds: [embed], components: [row] });
  }

  // ------------------------
  // Close Panels
  // ------------------------
  if (command === 'close') {
    const type = args[0];
    if (type === 'mod') panelsStatus.mod = false;
    if (type === 'supporter') panelsStatus.supporter = false;

    const channel = message.channel as TextChannel;
    channel.send(`✅ ${type} Bewerbungen wurden geschlossen. Panel Buttons werden deaktiviert.`);
  }

  // ------------------------
  // Open Ticket Command
  // ------------------------
  if (command === 'open') {
    const type = args[0]; // mod/supporter/frage/vorschlag
    if ((type === 'mod' && !panelsStatus.mod) || (type === 'supporter' && !panelsStatus.supporter)) {
      return message.author.send(`${type} Bewerbungen sind aktuell geschlossen.`);
    }

    const ticketName = `${type}-${message.author.username}`.toLowerCase().slice(0, 90);
    const guild = message.guild;
    const channel = await guild.channels.create(ticketName, {
      type: 0,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: message.author.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] },
      ],
    });

    tickets.set(channel.id, { userId: message.author.id, type, priority: 1, channelId: channel.id });

    const ticketEmbed = new MessageEmbed()
      .setTitle(`🎫 Neues Ticket: ${type}`)
      .setDescription(`Dein Ticket wurde erstellt. Bitte beantworte die Fragen im Channel.\n\n**User:** <@${message.author.id}>\n**Typ:** ${type}`)
      .setColor('GREEN');

    const ticketRow = new MessageActionRow()
      .addComponents(
        new MessageButton().setCustomId('close').setLabel('Close Ticket').setStyle('DANGER'),
        new MessageButton().setCustomId('claim').setLabel('Claim Ticket').setStyle('PRIMARY'),
        new MessageButton().setCustomId('priority').setLabel('Set Priority').setStyle('SECONDARY')
      );

    await channel.send({ content: `<@${message.author.id}>`, embeds: [ticketEmbed], components: [ticketRow] });

    message.reply(`✅ Dein Ticket wurde erstellt: <#${channel.id}>`);
  }
});

// ------------------------
// Button Handling
// ------------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;
  const ticket = tickets.get(interaction.channelId);
  if (!ticket) return;

  if (interaction.customId === 'close') {
    const channel = interaction.channel as TextChannel;
    if (CLOSED_CATEGORY_ID) await channel.setParent(CLOSED_CATEGORY_ID);
    await channel.setName(`closed-${channel.name}`);
    await channel.send(`Das Ticket wurde von <@${interaction.user.id}> geschlossen.`);
    tickets.delete(channel.id);
    await interaction.reply({ content: 'Ticket geschlossen!', ephemeral: true });
  }

  if (interaction.customId === 'claim') {
    await interaction.reply({ content: `Ticket von <@${ticket.userId}> wurde von <@${interaction.user.id}> übernommen.`, ephemeral: false });
  }

  if (interaction.customId === 'priority') {
    ticket.priority = ticket.priority === 3 ? 1 : ticket.priority + 1; // Cycle 1-3
    await interaction.reply({ content: `Ticket-Priorität ist jetzt ${ticket.priority}`, ephemeral: true });
  }
});

client.login(TOKEN);

