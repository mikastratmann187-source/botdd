import dotenv from "dotenv";
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
  TextChannel,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  ChannelType,
  EmbedBuilder,
  SelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN!;
const GUILD_ID = process.env.GUILD_ID!;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID!;
const CLOSED_CATEGORY_ID = process.env.CLOSED_CATEGORY_ID!;
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
});

// In-Memory Storage für Bewerbungs-Panels & Ticket-Prioritäten
const panels: Record<string, { enabled: boolean; messageId?: string; channelId?: string }> = {
  mod: { enabled: true },
  supporter: { enabled: true },
};
const ticketPriority: Record<string, number> = {}; // channelId -> priority
const ticketTypeMap: Record<string, string> = {}; // channelId -> type

// ----------------------------------
// REGISTER SLASH COMMANDS
// ----------------------------------
const commands = [
  {
    name: "ticket",
    description: "Ticket System Befehle",
    options: [
      {
        type: 1, name: "setup", description: "Erstellt das Ticket Panel",
        options: [{ type: 7, name: "channel", description: "Wähle den Channel für das Panel", required: true }],
      },
      {
        type: 1, name: "open", description: "Öffnet ein Ticket manuell",
        options: [{ type: 3, name: "type", description: "Art des Tickets", required: true }],
      },
      {
        type: 1, name: "close", description: "Schließt Panel oder Ticket",
        options: [{ type: 3, name: "type", description: "mod oder supporter", required: true }],
      },
      {
        type: 1, name: "priority", description: "Setzt Priorität eines Tickets",
        options: [
          { type: 3, name: "ticket_id", description: "Ticket Channel ID", required: true },
          { type: 4, name: "level", description: "Priorität 1-5", required: true },
        ],
      },
      {
        type: 1, name: "news", description: "Sendet News in Channel",
        options: [
          { type: 7, name: "channel", description: "Channel für News", required: true },
          { type: 3, name: "message", description: "Was ist neu?", required: true },
        ],
      },
    ],
  },
];

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);

  if (!client.application?.owner) await client.application?.fetch();
  const guild = client.guilds.cache.get(GUILD_ID);
  if (guild) {
    await guild.commands.set(commands);
    console.log("✅ Commands registriert");
  }
});

// ----------------------------------
// INTERACTION HANDLER
// ----------------------------------
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const cmd = interaction.commandName;
    const sub = interaction.options.getSubcommand();

    // --------------------------
    // TICKET SETUP
    // --------------------------
    if (cmd === "ticket" && sub === "setup") {
      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const embed = new EmbedBuilder()
        .setTitle("Ticket Panel")
        .setDescription("Wähle hier zwischen Frage, Mod- oder Supporter-Bewerbung oder Vorschlag")
        .setColor(0x00ff99)
        .setFooter({ text: "Klicke auf einen Button oder Dropdown um ein Ticket zu erstellen" });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("mod").setLabel("Mod-Bewerbung").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("supporter").setLabel("Supporter-Bewerbung").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("frage").setLabel("Frage").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("vorschlag").setLabel("Vorschlag").setStyle(ButtonStyle.Success)
      );

      const msg = await channel.send({ embeds: [embed], components: [row] });

      panels.mod.messageId = msg.id;
      panels.mod.channelId = channel.id;
      panels.supporter.messageId = msg.id;
      panels.supporter.channelId = channel.id;

      await interaction.reply({ content: "✅ Ticket-Panel erstellt!", ephemeral: true });
    }

    // --------------------------
    // TICKET OPEN
    // --------------------------
    if (cmd === "ticket" && sub === "open") {
      const type = interaction.options.getString("type", true);
      await createTicket(interaction, type);
    }

    // --------------------------
    // TICKET CLOSE PANEL
    // --------------------------
    if (cmd === "ticket" && sub === "close") {
      const type = interaction.options.getString("type", true);
      if (panels[type]) {
        panels[type].enabled = false;
        const ch = interaction.guild?.channels.cache.get(panels[type].channelId!) as TextChannel;
        const msg = await ch.messages.fetch(panels[type].messageId!);
        const row = msg.components[0].components.map(b => b.setDisabled(true));
        await msg.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(row as any)] });
        await interaction.reply({ content: `✅ ${type} Bewerbungen wurden geschlossen!`, ephemeral: true });
      }
    }

    // --------------------------
    // TICKET PRIORITY
    // --------------------------
    if (cmd === "ticket" && sub === "priority") {
      const ticketId = interaction.options.getString("ticket_id", true);
      const level = interaction.options.getInteger("level", true);
      ticketPriority[ticketId] = level;

      const ch = interaction.guild?.channels.cache.get(ticketId) as TextChannel;
      if (ch) await ch.setName(`${ch.name}-prio${level}`);
      await interaction.reply({ content: `✅ Priorität für ${ticketId} auf ${level} gesetzt`, ephemeral: true });
    }

    // --------------------------
    // NEWS
    // --------------------------
    if (cmd === "ticket" && sub === "news") {
      const channel = interaction.options.getChannel("channel", true) as TextChannel;
      const message = interaction.options.getString("message", true);
      const embed = new EmbedBuilder().setTitle("News/Update").setDescription(message).setColor(0xffcc00);
      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: `✅ News gesendet`, ephemeral: true });
    }
  }

  // --------------------------
  // BUTTON INTERACTIONS
  // --------------------------
  if (interaction.isButton()) {
    const type = interaction.customId;
    if (type === "mod" && !panels.mod.enabled) {
      await interaction.user.send("❌ Mod-Bewerbungen sind aktuell geschlossen.");
      return interaction.reply({ content: "❌ Bewerbungen sind geschlossen", ephemeral: true });
    }
    if (type === "supporter" && !panels.supporter.enabled) {
      await interaction.user.send("❌ Supporter-Bewerbungen sind aktuell geschlossen.");
      return interaction.reply({ content: "❌ Bewerbungen sind geschlossen", ephemeral: true });
    }
    await createTicket(interaction, type);
  }
});

// ----------------------------------
// HELPER: TICKET ERSTELLEN
// ----------------------------------
async function createTicket(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  type: string
) {
  const guild = interaction.guild;
  if (!guild) return;

  const name = `ticket-${type}-${interaction.user.username.toLowerCase()}`.slice(0, 90);
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
    { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels] },
  ];

  const ch = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: overwrites,
  });

  ticketTypeMap[ch.id] = type;

  const embed = new EmbedBuilder()
    .setTitle(`Ticket: ${type}`)
    .setDescription(`Willkommen <@${interaction.user.id}>!\nHier kannst du dein Anliegen bearbeiten.`)
    .setColor(0x00ffcc)
    .setFooter({ text: `Ticket erstellt am ${new Date().toLocaleString()}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("close_ticket").setLabel("Ticket schließen").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("claim_ticket").setLabel("Ticket übernehmen").setStyle(ButtonStyle.Secondary)
  );

  await ch.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
  if (interaction.isButton()) await interaction.reply({ content: `✅ Ticket erstellt: <#${ch.id}>`, ephemeral: true });
  else await interaction.followUp({ content: `✅ Ticket erstellt: <#${ch.id}>`, ephemeral: true });
}

// ----------------------------------
// LOGIN
// ----------------------------------
client.login(TOKEN).catch(console.error);
