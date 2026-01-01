import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { startBot } from "./bot";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Start the Discord Bot
  startBot();

  // API Routes for the Dashboard
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "Bot is alive" });
  });

  app.get(api.tickets.list.path, async (req, res) => {
    const tickets = await storage.getTickets();
    res.json(tickets);
  });

  app.get(api.tickets.get.path, async (req, res) => {
    const ticket = await storage.getTicket(Number(req.params.id));
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    res.json(ticket);
  });

  app.post("/api/tickets/:id/claim", async (req, res) => {
    const ticket = await storage.getTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    
    const { userId } = req.body;
    const updated = await storage.updateTicket(ticket.id, { claimedBy: userId });
    
    // Notify Discord
    const { client } = require("./bot");
    const channel = await client.channels.fetch(ticket.discordChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send(`Ticket wurde über das Dashboard von <@${userId}> übernommen.`);
    }

    res.json(updated);
  });

  app.post("/api/tickets/:id/close", async (req, res) => {
    const ticket = await storage.getTicket(Number(req.params.id));
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    
    const updated = await storage.updateTicket(ticket.id, { status: "closed" });
    
    // Notify Discord and Close
    const { client } = require("./bot");
    const channel = await client.channels.fetch(ticket.discordChannelId).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send("Ticket wird über das Dashboard geschlossen...");
      setTimeout(() => channel.delete().catch(() => {}), 5000);
    }

    res.json(updated);
  });

  return httpServer;
}
