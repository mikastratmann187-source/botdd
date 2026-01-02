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
  ChannelType 
} from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN!;
const GUILD_ID = process.env.GUILD_ID!;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID!;
const CLOSED_CATEGORY_ID = process.env.CLOSED_CATEGORY_ID!;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID!;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

// ----------------------
// Panel State
// ----------------------
let modOpen = true;
let supporterOpen = true;

// ----------------------
// Helper
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
// Client Ready
// ----------------------
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  client.user?.setPresence({ activities: [{ name: "Tickets verwalten" }], status: "online" });

  const guild = await client.guilds.fetch(GUILD_ID);

  // Register commands
  const commands = [
    { name: "close", description: "Schließt ein Bewerbungs-Panel oder Ticket", options: [{ name: "type", type: 3, description: "modbewerbung oder supporterbewerbung", required: true }] },
    { name: "open", description: "Öffnet ein Bewerbungs-Panel", options: [{ name: "type", type: 3, description: "modbewerbung oder supporterbewerbung", required: true }] },
    { name: "news", description: "Schickt Update News", options: [{ name: "channel", type: 7, description: "Wähle den Channel aus", required: true }] },
    { name: "priority", description: "Setzt Ticket-Priorität", options: [{ name: "level", type: 4, description: "1=Low, 5=High", required: true }] }
  ];

  await guild.commands.set(commands);
  console.log("✅ Commands registered");
});

// ----------------------
// Ticket Panel erstellen
// ----------------------
async function sendTicketPanel(channel: TextChannel) {
  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder().setCustomId("ticket_mod").setLabel("Mod-Bewerbung").setStyle(ButtonStyle.Primary).setDisabled(!modOpen),
      new ButtonBuilder().setCustomId("ticket_supporter").setLabel("Supporter-Bewerbung").setStyle(ButtonStyle.Primary).setDisabled(!supporterOpen),
      new ButtonBuilder().setCustomId("ticket_frage").setLabel("Frage").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("ticket_vorschlag").setLabel("Vorschlag").setStyle(ButtonStyle.Secondary)
    );

  await channel.send({ content: "🎫 **Wähle deinen Ticket-Typ aus:**", components: [row] });
}

// ----------------------
// Interaction Handler
// ----------------------
client.on("interactionCreate", async (interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction) => {
  try {
    // ----------------------
    // Slash Commands
    // ----------------------
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === "close") {
        const type = interaction.options.getString("type")!;
        if (type === "modbewerbung") modOpen = false;
        if (type === "supporterbewerbung") supporterOpen = false;

        await interaction.reply({ content: `${type} Panel geschlossen`, ephemeral: true });
        return;
      }

      if (commandName === "open") {
        const type = interaction.options.getString("type")!;
        if (type === "modbewerbung") modOpen = true;
        if (type === "supporterbewerbung") supporterOpen = true;

        await interaction.reply({ content: `${type} Panel geöffnet`, ephemeral: true });
        return;
      }

      if (commandName === "news") {
        const channel = interaction.options.getChannel("channel") as TextChannel;
        await channel.send("📰 **Neues Update:**\nAlles was neu ist, wird hier angezeigt.");
        await interaction.reply({ content: "News gesendet", ephemeral: true });
        return;
      }

      if (commandName === "priority") {
        const level = interaction.options.getInteger("level")!;
        await interaction.reply({ content: `Ticket-Priorität auf ${level} gesetzt`, ephemeral: true });
        return;
      }
    }

    // ----------------------
    // Button Interactions
    // ----------------------
    if (interaction.isButton()) {
      const guild = interaction.guild;
      if (!guild) return;

      let type: "mod" | "supporter" | "frage" | "vorschlag" = "frage";
      if (interaction.customId === "ticket_mod") type = "mod";
      if (interaction.customId === "ticket_supporter") type = "supporter";
      if (interaction.customId === "ticket_frage") type = "frage";
      if (interaction.customId === "ticket_vorschlag") type = "vorschlag";

      if ((type === "mod" && !modOpen) || (type === "supporter" && !supporterOpen)) {
        await interaction.user.send(`❌ ${type === "mod" ? "Mod" : "Supporter"}-Bewerbungen sind aktuell geschlossen`);
        return;
      }

      // Ticket erstellen
      const name = `${type}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: SUPPORT_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ];

      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites,
        parent: TICKET_CATEGORY_ID
      });

      // Embed erstellen
      const embedContent = {
        color: type === "mod" ? 0xff0000 : type === "supporter" ? 0xffff00 : 0x00ff00,
        title: type === "mod" ? "Mod-Bewerbung" : type === "supporter" ? "Supporter-Bewerbung" : type === "frage" ? "Frage-Ticket" : "Vorschlag-Ticket",
        description: `Hallo <@${interaction.user.id}>, dies ist dein Ticket. Bitte beantworte die Fragen oder schreibe deine Frage.`,
        timestamp: new Date()
      };

      // Modal für Bewerbungen
      if (type === "mod" || type === "supporter") {
        const modal = new ModalBuilder().setCustomId(`modal_${type}`).setTitle(`${type === "mod" ? "Mod" : "Supporter"} Bewerbung`);
        const q1 = new TextInputBuilder().setCustomId("frage1").setLabel("Warum willst du diese Rolle?").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const q2 = new TextInputBuilder().setCustomId("frage2").setLabel("Warum solltest genau du genommen werden?").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(q1), new ActionRowBuilder<TextInputBuilder>().addComponents(q2));
        await interaction.showModal(modal);
        return;
      }

      await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embedContent] });
      await interaction.reply({ content: `Ticket erstellt: <#${channel.id}>`, ephemeral: true });
      return;
    }

    // ----------------------
    // Modal Submit
    // ----------------------
    if (interaction.isModalSubmit()) {
      const channel = interaction.channel as TextChannel;
      const responses = [
        interaction.fields.getTextInputValue("frage1"),
        interaction.fields.getTextInputValue("frage2")
      ];
      await channel.send(`**Antworten vom Bewerber:**\n1️⃣ ${responses[0]}\n2️⃣ ${responses[1]}`);
      await safeInteractionCall(interaction, "reply", { content: "Bewerbung erfolgreich gesendet!", ephemeral: true });
      return;
    }

  } catch (err) {
    console.error(err);
    try {
      await safeInteractionCall(interaction, "reply", { content: "Fehler aufgetreten", ephemeral: true });
    } catch {}
  }
});

// ----------------------
// Login
// ----------------------
client.login(TOKEN);

