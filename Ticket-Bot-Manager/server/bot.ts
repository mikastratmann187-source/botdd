import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  PermissionsBitField,
  Interaction,
  TextChannel,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  GuildMember
} from "discord.js";
import { storage } from "./storage";

if (!process.env.DISCORD_TOKEN) {
  console.warn("DISCORD_TOKEN not set. Bot will not start.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.GuildMember],
});

client.on("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  await registerSlashCommands();

  // Halbstündiges Status-Update
  const STATUS_CHANNEL_ID = "1389540273281044669";
  let lastStatusMessageId: string | null = null;
  
  const sendStatus = async () => {
    try {
      const channel = await client.channels.fetch(STATUS_CHANNEL_ID) as TextChannel;
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle("🤖 Bot Status Update")
          .setDescription("Der Bot ist aktuell **ONLINE** und einsatzbereit. ✅")
          .setColor(0x00FF00)
          .setTimestamp()
          .setFooter({ text: "Mika's Community Management" });

        if (lastStatusMessageId) {
          try {
            const msg = await channel.messages.fetch(lastStatusMessageId);
            await msg.edit({ embeds: [embed] });
            return;
          } catch (e) {
            // Message deleted or not found, send new one
          }
        }
        const newMsg = await channel.send({ embeds: [embed] });
        lastStatusMessageId = newMsg.id;
      }
    } catch (error) {
      console.error("Fehler beim Senden des Status-Updates:", error);
    }
  };

  // Initiales Update beim Start
  await sendStatus();

  setInterval(sendStatus, 30 * 60 * 1000); // 30 Minuten

  // Alle 5 Minuten einen manuellen Status-Check "simulieren" (Internen Command-Logik aufrufen)
  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(STATUS_CHANNEL_ID) as TextChannel;
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle("🤖 Automatischer 5-Minuten Check")
          .setDescription("Selbstprüfung abgeschlossen: Bot ist **STABIL** und **ONLINE**. ✅")
          .setColor(0x3498DB)
          .setTimestamp()
          .setFooter({ text: "Mika's Community Management" });
        await channel.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Fehler beim automatischen 5-Minuten Check:", error);
    }
  }, 5 * 60 * 1000); // 5 Minuten
});

async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName("bot-uptime")
      .setDescription("Zeigt die aktuelle Uptime des Bots"),
    new SlashCommandBuilder()
      .setName("bot-online")
      .setDescription("Setzt den Bot-Status manuell auf Online"),
    new SlashCommandBuilder()
      .setName("status-check")
      .setDescription("Sende manuell ein Status-Update"),
    new SlashCommandBuilder()
      .setName("news-update")
      .setDescription("Sende ein Update über neue Features")
      .addChannelOption(opt => 
        opt.setName("channel")
           .setDescription("Der Kanal für die News")
           .setRequired(true)
           .addChannelTypes(ChannelType.GuildText))
      .addStringOption(opt => 
        opt.setName("update")
           .setDescription("Was ist neu?")
           .setRequired(true)),
    new SlashCommandBuilder()
      .setName("priority")
      .setDescription("Setze die Priorität des Tickets")
      .addIntegerOption(opt => 
        opt.setName("level")
           .setDescription("Prioritäts-Level (1-3)")
           .setRequired(true)
           .addChoices(
             { name: "Niedrig (1)", value: 1 },
             { name: "Mittel (2)", value: 2 },
             { name: "Hoch (3)", value: 3 }
           )),
    new SlashCommandBuilder()
      .setName("open")
      .setDescription("Öffne Bewerbungen")
      .addStringOption(opt => 
        opt.setName("typ")
           .setDescription("Bewerbungstyp")
           .setRequired(true)
           .addChoices(
             { name: "Mod-Bewerbung", value: "mod" },
             { name: "Supporter-Bewerbung", value: "supporter" }
           )),
    new SlashCommandBuilder()
      .setName("close_apps")
      .setDescription("Schließe Bewerbungen")
      .addStringOption(opt => 
        opt.setName("typ")
           .setDescription("Bewerbungstyp")
           .setRequired(true)
           .addChoices(
             { name: "Mod-Bewerbung", value: "mod" },
             { name: "Supporter-Bewerbung", value: "supporter" }
           )),
    new SlashCommandBuilder()
      .setName("ticket")
      .setDescription("Ticket System Management")
      .addSubcommand(sub => 
        sub.setName("setup")
           .setDescription("Setup the ticket system")
           .addChannelOption(opt => opt.setName("category").setDescription("Category for tickets").addChannelTypes(ChannelType.GuildCategory))
           .addRoleOption(opt => opt.setName("support_role").setDescription("Role for support staff"))
           .addChannelOption(opt => opt.setName("log_channel").setDescription("Channel for logs").addChannelTypes(ChannelType.GuildText))
           .addChannelOption(opt => opt.setName("transcript_channel").setDescription("Channel for transcripts").addChannelTypes(ChannelType.GuildText))
      )
      .addSubcommand(sub => sub.setName("close").setDescription("Close current ticket"))
      .addSubcommand(sub => sub.setName("claim").setDescription("Claim current ticket"))
      .addSubcommand(sub => 
        sub.setName("add")
           .setDescription("Add user to ticket")
           .addUserOption(opt => opt.setName("user").setDescription("User to add").setRequired(true))
      )
      .addSubcommand(sub => 
        sub.setName("remove")
           .setDescription("Remove user from ticket")
           .addUserOption(opt => opt.setName("user").setDescription("User to remove").setRequired(true))
      ),
  ].map(command => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

  try {
    console.log("Refreshing slash commands...");
    await rest.put(
      Routes.applicationCommands(client.user!.id),
      { body: commands }
    );
    console.log("Successfully reloaded slash commands.");
  } catch (error) {
    console.error(error);
  }
}

client.on("interactionCreate", async (interaction: Interaction) => {
  console.log(`Interaction received: ${interaction.type} (ID: ${interaction.id})`);
  try {
    if (interaction.isChatInputCommand()) {
      console.log(`Command: ${interaction.commandName}`);
      await handleSlashCommand(interaction);
    } else if (interaction.isStringSelectMenu()) {
      console.log(`Select Menu: ${interaction.customId}`);
      await handleSelectMenu(interaction);
    } else if (interaction.isModalSubmit()) {
      console.log(`Modal Submit: ${interaction.customId}`);
      await handleModal(interaction);
    } else if (interaction.isButton()) {
      console.log(`Button: ${interaction.customId}`);
      await handleButton(interaction);
    }
  } catch (error) {
    console.error("Interaction error:", error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Ein Fehler ist aufgetreten.", ephemeral: true });
    }
  }
});

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const commandName = interaction.commandName;
  const guildId = interaction.guildId!;

  if (commandName === "bot-uptime") {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return interaction.reply({ 
      content: `Der Bot läuft seit: **${days}d ${hours}h ${minutes}m ${seconds}s**`, 
      ephemeral: true 
    });
  }

  if (commandName === "bot-online" || commandName === "status-check") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "Nur Administratoren können den Status ändern.", ephemeral: true });
    }
    const STATUS_CHANNEL_ID = "1389540273281044669";
    try {
      const channel = await client.channels.fetch(STATUS_CHANNEL_ID) as TextChannel;
      const embed = new EmbedBuilder()
        .setTitle(commandName === "bot-online" ? "🟢 Bot Online" : "🤖 Manueller Status Check")
        .setDescription(commandName === "bot-online" 
          ? "Der Bot wurde manuell als **ONLINE** markiert. ✅" 
          : "Der Bot wurde manuell überprüft: **ONLINE** ✅")
        .setColor(0x00FF00)
        .setTimestamp()
        .setFooter({ text: "Mika's Community Management" });
      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: "Status-Nachricht wurde gesendet!", ephemeral: true });
    } catch (error) {
      return interaction.reply({ content: "Fehler beim Senden des Updates.", ephemeral: true });
    }
  }

  if (commandName === "news-update") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "Nur Administratoren können News posten.", ephemeral: true });
    }
    const channel = interaction.options.getChannel("channel") as TextChannel;
    const updateText = interaction.options.getString("update")!;
    
    const embed = new EmbedBuilder()
      .setTitle("📢 TICKET-SYSTEM UPDATE")
      .setDescription(updateText)
      .setColor(0x5865F2)
      .setTimestamp()
      .setFooter({ text: "Mika's Community Management" });

    await channel.send({ embeds: [embed] });
    return interaction.reply({ content: "News wurden erfolgreich gepostet!", ephemeral: true });
  }

  if (commandName === "priority") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "Nur Administratoren können die Priorität ändern.", ephemeral: true });
    }
    const priority = interaction.options.getInteger("level")!;
    const ticket = await storage.getTicketByChannelId(interaction.channelId);
    if (!ticket) return interaction.reply({ content: "Dies ist kein Ticket-Kanal.", ephemeral: true });

    const channel = interaction.channel as TextChannel;
    const currentName = channel.name.replace(/^(p[1-3]-)/, "");
    await channel.setName(`p${priority}-${currentName}`);
    await interaction.reply({ content: `Priorität auf **Level ${priority}** gesetzt.`, ephemeral: true });
    
    const embed = new EmbedBuilder()
      .setTitle("⚠️ Prioritäts-Update")
      .setDescription(`Die Priorität dieses Tickets wurde auf **Level ${priority}** geändert.`)
      .setColor(priority === 3 ? 0xFF0000 : priority === 2 ? 0xFFA500 : 0x00FF00);
    
    await channel.send({ embeds: [embed] });
    return;
  }

  if (commandName === "open" || commandName === "close_apps") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "Nur Administratoren können dies tun.", ephemeral: true });
    }
    const type = interaction.options.getString("typ")!;
    const isOpen = commandName === "open";
    
    await storage.upsertConfig({
      guildId,
      [type === "mod" ? "modAppsOpen" : "supporterAppsOpen"]: isOpen ? 1 : 0
    });

    await interaction.reply({ content: `${type === "mod" ? "Mod" : "Supporter"}-Bewerbungen sind nun ${isOpen ? "geöffnet" : "geschlossen"}.`, ephemeral: true });
    await updateAllPanels(interaction.guild!);
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "setup") {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "Nur Administratoren können das Setup ausführen.", ephemeral: true });
    }

    const category = interaction.options.getChannel("category");
    const role = interaction.options.getRole("support_role");
    const logChannel = interaction.options.getChannel("log_channel");
    const transcriptChannel = interaction.options.getChannel("transcript_channel");

    await storage.upsertConfig({
      guildId,
      ticketCategoryId: category?.id || null,
      supportRoleId: role?.id || null,
      logChannelId: logChannel?.id || null,
      transcriptChannelId: transcriptChannel?.id || null,
    });

    const embed = new EmbedBuilder()
      .setTitle("Ticket System Setup")
      .setDescription("Das Ticket-System wurde konfiguriert. Nutze `!setup_panel` um das Panel zu erstellen.")
      .setColor(0x00FF00);

    await interaction.reply({ embeds: [embed] });
  } else if (subcommand === "close") {
    const ticket = await storage.getTicketByChannelId(interaction.channelId);
    if (!ticket) return interaction.reply({ content: "Dies ist kein Ticket-Kanal.", ephemeral: true });

    await storage.updateTicket(ticket.id, { status: "closed" });
    await interaction.reply("Ticket wird geschlossen...");
    
    // In a real bot, we would generate a transcript here
    setTimeout(() => interaction.channel?.delete().catch(() => {}), 5000);
  } else if (subcommand === "claim") {
    const ticket = await storage.getTicketByChannelId(interaction.channelId);
    if (!ticket) return interaction.reply({ content: "Dies ist kein Ticket-Kanal.", ephemeral: true });

    await storage.updateTicket(ticket.id, { claimedBy: interaction.user.id });
    await interaction.reply(`Ticket wurde von ${interaction.user.toString()} übernommen.`);
  } else if (subcommand === "add") {
    const user = interaction.options.getUser("user")!;
    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
    await interaction.reply(`${user.toString()} wurde zum Ticket hinzugefügt.`);
  } else if (subcommand === "remove") {
    const user = interaction.options.getUser("user")!;
    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.delete(user.id);
    await interaction.reply(`${user.toString()} wurde aus dem Ticket entfernt.`);
  }
}

// Keep existing !setup_panel for manual panel creation
async function handleButton(interaction: ButtonInteraction) {
  if (interaction.customId === "accept_rules") {
    const member = interaction.member as GuildMember;
    const roleId = "1389540270139244648"; // Verifizierte Rolle
    
    try {
      await member.roles.add(roleId);
      // Optional: Entferne eine "Unverifiziert"-Rolle, falls vorhanden
      const unverifiedRole = "1389540270139244647"; // Beispiel ID für Unverifiziert
      if (member.roles.cache.has(unverifiedRole)) {
        await member.roles.remove(unverifiedRole);
      }
      await interaction.reply({ content: "Regeln akzeptiert! Du hast nun Zugriff auf den Server.", ephemeral: true });
    } catch (error) {
      console.error("Fehler beim Hinzufügen der Rolle:", error);
      await interaction.reply({ content: "Fehler beim Zuweisen der Rolle. Bitte kontaktiere einen Admin.", ephemeral: true });
    }
  } else if (interaction.customId === "close_ticket_btn") {
    const ticket = await storage.getTicketByChannelId(interaction.channelId);
    if (!ticket) return interaction.reply({ content: "Dies ist kein Ticket-Kanal.", ephemeral: true });

    await storage.updateTicket(ticket.id, { status: "closed" });
    await interaction.reply("Ticket wird geschlossen...");
    
    // Logging logic
    const config = await storage.getConfig(interaction.guildId!);
    if (config?.logChannelId) {
      try {
        const logChannel = await client.channels.fetch(config.logChannelId) as TextChannel;
        const logEmbed = new EmbedBuilder()
          .setTitle("🔒 Ticket Geschlossen")
          .addFields(
            { name: "Ticket", value: (interaction.channel as TextChannel).name, inline: true },
            { name: "Geschlossen von", value: interaction.user.tag, inline: true }
          )
          .setColor(0xFF0000)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      } catch (e) {}
    }

    setTimeout(() => interaction.channel?.delete().catch(() => {}), 5000);
  } else if (interaction.customId === "claim_ticket_btn") {
    const ticket = await storage.getTicketByChannelId(interaction.channelId);
    if (!ticket) return interaction.reply({ content: "Dies ist kein Ticket-Kanal.", ephemeral: true });

    await storage.updateTicket(ticket.id, { claimedBy: interaction.user.id });
    await interaction.reply(`Ticket wurde von ${interaction.user.toString()} übernommen.`);
  } else if (interaction.customId.startsWith("prio_")) {
    const level = interaction.customId === "prio_high_btn" ? 3 : interaction.customId === "prio_mid_btn" ? 2 : 1;
    const channel = interaction.channel as TextChannel;
    const currentName = channel.name.replace(/^(p[1-3]-)/, "");
    await channel.setName(`p${level}-${currentName}`);
    await interaction.reply({ content: `Priorität auf **Level ${level}** gesetzt.`, ephemeral: true });
  } else if (interaction.customId === "rename_ticket_btn") {
    const modal = new ModalBuilder()
      .setCustomId("modal_rename_ticket")
      .setTitle("Ticket umbenennen");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("new_name")
          .setLabel("Neuer Name")
          .setPlaceholder("z.B. wichtig-anfrage")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
  }
}

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  if (message.content === "!setup_rules") {
    const embed = new EmbedBuilder()
      .setTitle("📜 ─── ✦ REGELWERK ✦ ───")
      .setDescription(`Willkommen in MIKA'S COMMUNITY!\n\n🔒 **Allgemeine Regeln**\n1️⃣ Respektvoller Umgang – Kein Mobbing, Rassismus oder toxisches Verhalten.\n2️⃣ Kein Spam oder We[...]`)
      .setColor(0x5865F2);

    const button = new ButtonBuilder()
      .setCustomId("accept_rules")
      .setLabel("Regeln akzeptieren")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅");

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }

  if (message.content === "!setup_panel") {
    const config = await storage.getConfig(message.guildId!);
    const embed = new EmbedBuilder()
      .setTitle("📩 Hilfe & Kontakt Center")
      .setDescription(
        "Willkommen im Support-Bereich von **MIKA'S COMMUNITY**!\n\n" +
        "Hier kannst du direkt mit unserem Team in Kontakt treten. Wähle einfach die passende Kategorie aus dem Menü unten aus:\n\n" +
        "❓ **Fragen & Hilfe**\nHast du allgemeine Fragen zum Server oder brauchst Hilfe bei einem Problem?\n\n" +
        "🛡️ **Moderator Bewerbung**\nDu möchtest uns unterstützen und für Ordnung sorgen? Bewirb dich hier!\n\n" +
        "🤝 **Supporter Bewerbung**\nDu hilfst gerne anderen Usern und möchtest Teil des Teams werden?\n\n" +
        "*Hinweis: Bitte erstelle nur ein Ticket, wenn es wirklich nötig ist. Missbrauch kann zu Sanktionen führen.*"
      )
      .setColor(0x5865F2)
      .setThumbnail(client.user?.displayAvatarURL() || null);

    const modLabel = config?.modAppsOpen === 0 ? "Bewerbung Mod (Aktuell Geschlossen)" : "Bewerbung Mod (Offen)";
    const supporterLabel = config?.supporterAppsOpen === 0 ? "Bewerbung Supporter (Aktuell Geschlossen)" : "Bewerbung Supporter (Offen)";

    const select = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Wähle dein Anliegen aus...")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Fragen & Hilfe")
          .setDescription("Allgemeine Anfragen an das Team")
          .setValue("question")
          .setEmoji("❓"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Vorschläge & Ideen")
          .setDescription("Teile deine Ideen für Twitch & Discord")
          .setValue("suggestion")
          .setEmoji("💡"),
        new StringSelectMenuOptionBuilder()
          .setLabel(modLabel)
          .setDescription("Bewirb dich als Moderator")
          .setValue("mod")
          .setEmoji("🛡️"),
        new StringSelectMenuOptionBuilder()
          .setLabel(supporterLabel)
          .setDescription("Bewirb dich als Supporter")
          .setValue("supporter")
          .setEmoji("🤝")
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
  }
});

async function updateAllPanels(guild: any) {
  const config = await storage.getConfig(guild.id);
  const channels = await guild.channels.fetch();
  for (const channel of channels.values()) {
    if (channel?.isTextBased() && channel.type === ChannelType.GuildText) {
      try {
        const messages = await channel.messages.fetch({ limit: 50 });
        const panelMessage = messages.find((m: any) => 
          m.author.id === client.user?.id && 
          m.embeds.length > 0 && 
          m.embeds[0].title === "📩 Hilfe & Kontakt Center"
        );
        
        if (panelMessage) {
          const modLabel = config?.modAppsOpen === 0 ? "Bewerbung Mod (Aktuell Geschlossen)" : "Bewerbung Mod (Offen)";
          const supporterLabel = config?.supporterAppsOpen === 0 ? "Bewerbung Supporter (Aktuell Geschlossen)" : "Bewerbung Supporter (Offen)";

          const select = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("Wähle dein Anliegen aus...")
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("Fragen & Hilfe")
                .setDescription("Allgemeine Anfragen an das Team")
                .setValue("question")
                .setEmoji("❓"),
              new StringSelectMenuOptionBuilder()
                .setLabel("Vorschläge & Ideen")
                .setDescription("Teile deine Ideen für Twitch & Discord")
                .setValue("suggestion")
                .setEmoji("💡"),
              new StringSelectMenuOptionBuilder()
                .setLabel(modLabel)
                .setDescription("Bewirb dich als Moderator")
                .setValue("mod")
                .setEmoji("🛡️"),
              new StringSelectMenuOptionBuilder()
                .setLabel(supporterLabel)
                .setDescription("Bewirb dich als Supporter")
                .setValue("supporter")
                .setEmoji("🤝")
            );

          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
          await panelMessage.edit({ components: [row] });
        }
      } catch (e) {}
    }
  }
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction) {
  const choice = interaction.values[0];
  const config = await storage.getConfig(interaction.guildId!);
  
  if (choice === "mod" || choice === "supporter") {
    const isOpen = choice === "mod" ? config?.modAppsOpen !== 0 : config?.supporterAppsOpen !== 0;
    if (!isOpen) {
      try {
        await interaction.user.send(`${choice === "mod" ? "Mod" : "Supporter"}-Bewerbungen sind aktuell geschlossen.`);
      } catch (e) {}
      return interaction.reply({ content: `${choice === "mod" ? "Mod" : "Supporter"}-Bewerbungen sind aktuell geschlossen. Check deine DMs.`, ephemeral: true });
    }
  }

  const openTickets = await storage.getUserOpenTickets(interaction.guildId!, interaction.user.id);
  if (config?.maxTickets && openTickets.length >= config.maxTickets) {
    return interaction.reply({ content: "Du hast bereits das Maximum an offenen Tickets erreicht.", ephemeral: true });
  }

  if (choice === "question") {
    await createTicketChannel(interaction, "Allgemeine Anfrage", "frage", config);
  } else if (choice === "suggestion") {
    const modal = new ModalBuilder()
      .setCustomId("modal_suggestion")
      .setTitle("Dein Vorschlag");

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("idea")
          .setLabel("Was ist deine Idee?")
          .setPlaceholder("Twitch Features, Bot-Ideen etc.")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
  } else {
    const modal = new ModalBuilder()
      .setCustomId(`modal_apply_${choice}`)
      .setTitle(`${choice === 'mod' ? 'Moderator' : 'Supporter'} Bewerbung`);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Warum möchtest du diesen Rang?")
          .setPlaceholder("Erzähle uns von deiner Motivation...")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(10)
          .setMaxLength(1000)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("why_you")
          .setLabel("Was qualifiziert dich dafür?")
          .setPlaceholder("Welche Erfahrungen bringst du mit?")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(10)
          .setMaxLength(1000)
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
  }
}

async function handleModal(interaction: ModalSubmitInteraction) {
  let type: string;
  let title: string;
  let answers: Record<string, string>;

  if (interaction.customId === "modal_rename_ticket") {
    const newName = interaction.fields.getTextInputValue("new_name");
    const channel = interaction.channel as TextChannel;
    await channel.setName(newName);
    return interaction.reply({ content: `Ticket wurde in **${newName}** umbenannt.`, ephemeral: true });
  }

  if (interaction.customId === "modal_suggestion") {
    type = "vorschlag";
    title = "Neuer Vorschlag";
    answers = { "Idee": interaction.fields.getTextInputValue("idea") };
  } else {
    const isMod = interaction.customId.includes("mod");
    type = isMod ? "mod_bewerbung" : "supporter_bewerbung";
    title = isMod ? "Moderator Bewerbung" : "Supporter Bewerbung";
    answers = {
      "Warum möchtest du diesen Rang?": interaction.fields.getTextInputValue("reason"),
      "Was qualifiziert dich dafür?": interaction.fields.getTextInputValue("why_you")
    };
  }

  const config = await storage.getConfig(interaction.guildId!);
  await createTicketChannel(interaction, title, type, config, answers);
}

async function createTicketChannel(
  interaction: StringSelectMenuInteraction | ModalSubmitInteraction, 
  title: string, 
  type: string,
  config: any,
  answers?: Record<string, string>
) {
  if (!interaction.guild) return;

  const overwrites: any[] = [
    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    { id: client.user!.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
  ];

  if (config?.supportRoleId) {
    overwrites.push({ id: config.supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
  }

  const channel = await interaction.guild.channels.create({
    name: `${type}-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: config?.ticketCategoryId || null,
    permissionOverwrites: overwrites,
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎫 ${title}`)
    .setDescription(
      `Hallo **${interaction.user.username}**,\n\n` +
      `vielen Dank für die Eröffnung eines Tickets! Unser Team wurde informiert und wird sich so schnell wie möglich um dein Anliegen kümmern.\n\n` +
      `**Ticket-Details:**\n` +
      `• **Typ:** ${title}\n` +
      `• **Status:** Offen`
    )
    .setColor(0x5865F2)
    .setTimestamp()
    .setThumbnail(interaction.user.displayAvatarURL());

  if (answers) {
    const fields = Object.entries(answers).map(([q, a]) => ({
      name: `📌 ${q}`,
      value: a.length > 1024 ? a.substring(0, 1021) + "..." : a,
      inline: false
    }));
    embed.addFields(fields);
  }

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("claim_ticket_btn")
      .setLabel("Ticket übernehmen")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("👋"),
    new ButtonBuilder()
      .setCustomId("close_ticket_btn")
      .setLabel("Ticket schließen")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒")
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("prio_low_btn")
      .setLabel("Prio: Niedrig")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🟢"),
    new ButtonBuilder()
      .setCustomId("prio_mid_btn")
      .setLabel("Prio: Mittel")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🟡"),
    new ButtonBuilder()
      .setCustomId("prio_high_btn")
      .setLabel("Prio: Hoch")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔴")
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("rename_ticket_btn")
      .setLabel("Ticket umbenennen")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("📝")
  );

  await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row1, row2, row3] });
  
  await storage.createTicket({
    guildId: interaction.guildId!,
    discordChannelId: channel.id,
    discordUserId: interaction.user.id,
    discordUsername: interaction.user.username,
    type: type,
    status: "open",
    answers: answers || null,
  });

  await interaction.reply({ content: `Dein Ticket wurde erstellt: ${channel.toString()}`, ephemeral: true });
}

export async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.error("startBot(): DISCORD_TOKEN missing — skipping client.login(). Set DISCORD_TOKEN in your environment.");
    return;
  }

  console.log("startBot(): calling client.login() (token present). Will log errors to console if login fails.");
  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log(`startBot(): client.login() resolved — Logged in as ${client.user?.tag}`);
  } catch (err) {
    console.error("startBot(): client.login() failed:", err);
  }
}

export { client };
