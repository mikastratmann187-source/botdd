import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const configs = pgTable("configs", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  ticketCategoryId: text("ticket_category_id"),
  supportRoleId: text("support_role_id"),
  logChannelId: text("log_channel_id"),
  transcriptChannelId: text("transcript_channel_id"),
  maxTickets: integer("max_tickets").default(3),
  cooldown: integer("cooldown").default(60), // seconds
  autoCloseTime: integer("auto_close_time").default(24), // hours
  welcomeMessage: text("welcome_message"),
  modAppsOpen: integer("mod_apps_open").default(1), // 1 = open, 0 = closed
  supporterAppsOpen: integer("supporter_apps_open").default(1),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  discordChannelId: text("discord_channel_id"),
  discordUserId: text("discord_user_id").notNull(),
  discordUsername: text("discord_username").notNull(),
  type: text("type").notNull(), 
  status: text("status").notNull().default("open"), 
  claimedBy: text("claimed_by"),
  answers: jsonb("answers"), 
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConfigSchema = createInsertSchema(configs);
export const insertTicketSchema = createInsertSchema(tickets).omit({ 
  id: true, 
  createdAt: true 
});

export type Config = typeof configs.$inferSelect;
export type InsertConfig = z.infer<typeof insertConfigSchema>;
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
