import { db } from "./db";
import { tickets, configs, type InsertTicket, type Ticket, type InsertConfig, type Config } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTickets(): Promise<Ticket[]>;
  getTicket(id: number): Promise<Ticket | undefined>;
  getTicketByChannelId(channelId: string): Promise<Ticket | undefined>;
  updateTicket(id: number, updates: Partial<Ticket>): Promise<Ticket>;
  
  getConfig(guildId: string): Promise<Config | undefined>;
  upsertConfig(config: InsertConfig): Promise<Config>;
  getUserOpenTickets(guildId: string, userId: string): Promise<Ticket[]>;
}

export class DatabaseStorage implements IStorage {
  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const [newTicket] = await db.insert(tickets).values(ticket).returning();
    return newTicket;
  }

  async getTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  }

  async getTicket(id: number): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }

  async getTicketByChannelId(channelId: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.discordChannelId, channelId));
    return ticket;
  }

  async updateTicket(id: number, updates: Partial<Ticket>): Promise<Ticket> {
    const [updated] = await db.update(tickets).set(updates).where(eq(tickets.id, id)).returning();
    return updated;
  }

  async getConfig(guildId: string): Promise<Config | undefined> {
    const [config] = await db.select().from(configs).where(eq(configs.guildId, guildId));
    return config;
  }

  async upsertConfig(config: InsertConfig): Promise<Config> {
    const [existing] = await db.select().from(configs).where(eq(configs.guildId, config.guildId));
    if (existing) {
      const [updated] = await db.update(configs).set(config).where(eq(configs.guildId, config.guildId)).returning();
      return updated;
    }
    const [inserted] = await db.insert(configs).values(config).returning();
    return inserted;
  }

  async getUserOpenTickets(guildId: string, userId: string): Promise<Ticket[]> {
    return await db.select().from(tickets).where(
      and(
        eq(tickets.guildId, guildId),
        eq(tickets.discordUserId, userId),
        eq(tickets.status, "open")
      )
    );
  }
}

export const storage = new DatabaseStorage();
