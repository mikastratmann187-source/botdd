import { Client, GatewayIntentBits, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel, ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, SelectMenuBuilder, StringSelectMenuInteraction } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN!;
if (!TOKEN) throw new Error("DISCORD_TOKEN nicht gesetzt!");

// ----------------------
// Client
// ----------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

// ----------------------
// Helper: Safe Interaction
// ----------------------
async function safeInteractionCall(interaction: any, fn: 'reply' | 'update' | 'followUp' | 'editReply', ...args: any[]) {
  try { return await (interaction[fn] as Function)(...args); }
  catch (err: any) {
    if (err && (err.code === 10062 || String(err.message).includes("Unknown interaction"))) return;
    console.error("Interaction error:", err);
  }
}

// ----------------------
// Ticket Settings (in Memory, später DB möglich)
// ----------------------
const ticketPanels: Record<string, { active: boolean }> = {
  mod: { active: true },
  supporter: { active: true },
};

const openTickets: Record<string, { userId: string; type: string; priority: number }> = {};

// ----------------------
// Start-Funktion
// ----------------------
export async function startBot() {
  client.once("ready", () => {
    console.log(`✅ Logged in as ${client.user?.tag}`);
  });

  client.on("interactionCreate", async (interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction) => {
    // ----------------------
    // Slash Commands
    // ----------------------
    if ('isChatInputCommand' in interaction && interaction.isChatInputCommand()) {
      const cmd = interaction.commandName;

      // ----------------------
      // Ticket Setup (Panel erstellen)
      // ----------------------
      if (cmd === "ticket") {
        const sub = interaction.options.getSubcommand();
        if (sub === "setup") {
          const channel = interaction.options.getChannel("channel", true);

          // Erstelle Embed & Panel
          const embed = {
            title: "Tickets",
            description: "Wähle, was du erstellen möchtest:",
            color: 0x00ff00
          };

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId("open_mod").setLabel("Mod-Bewerbung").setStyle(ButtonStyle.Primary).setDisabled(!ticketPanels.mod.active),
            new ButtonBuilder().setCustomId("open_supporter").setLabel("Supporter-Bewerbung").setStyle(ButtonStyle.Primary).setDisabled(!ticketPanels.supporter.active),
            new ButtonBuilder().setCustomId("open_question").setLabel("Frage").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId("open_suggestion").setLabel("Vorschlag").setStyle(ButtonStyle.Success)
          );

          await (channel as TextChannel).send({ embeds: [embed], components: [row] });
          await safeInteractionCall(interaction, "reply", { content: "✅ Ticket Panel erstellt!", ephemeral: true });
        }
      }
    }

    // ----------------------
    // Buttons
    // ----------------------
    if ('isButton' in interaction && interaction.isButton()) {
      const userId = interaction.user.id;
      let ticketType: string | null = null;

      if (interaction.customId === "open_mod") ticketType = "mod";
      if (interaction.customId === "open_supporter") ticketType = "supporter";
      if (interaction.customId === "open_question") ticketType = "question";
      if (interaction.customId === "open_suggestion") ticketType = "suggestion";

      if (!ticketType) return;

      // Check Panel aktiv
      if ((ticketType === "mod" && !ticketPanels.mod.active) || (ticketType === "supporter" && !ticketPanels.supporter.active)) {
        await safeInteractionCall(interaction, "reply", { content: `${ticketType.charAt(0).toUpperCase() + ticketType.slice(1)} Bewerbungen sind aktuell geschlossen.`, ephemeral: true });
        return;
      }

      // Ticket erstellen
      const guild = interaction.guild;
      if (!guild) return;

      const name = `${ticketType}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels] },
      ];

      const channel = await guild.channels.create({
        name,
        type: 0,
        permissionOverwrites: overwrites
      });

      openTickets[channel.id] = { userId, type: ticketType, priority: 1 };

      const closeButton = new ButtonBuilder().setCustomId("ticket_close").setLabel("Ticket schließen").setStyle(ButtonStyle.Danger);
      const claimButton = new ButtonBuilder().setCustomId("ticket_claim").setLabel("Ticket übernehmen").setStyle(ButtonStyle.Secondary);

      await channel.send({ content: `Hallo <@${userId}>! Dein Ticket wurde erstellt.`, components: [new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton, claimButton)] });
      await safeInteractionCall(interaction, "reply", { content: `✅ Ticket erstellt: <#${channel.id}>`, ephemeral: true });
    }

    // ----------------------
    // Modal Submit (z.B. Bewerbungs-Formular)
    // ----------------------
    if ('isModalSubmit' in interaction && interaction.isModalSubmit()) {
      // Formularhandling kann hier implementiert werden
    }
  });

  await client.login(TOKEN);
}

export { client };


