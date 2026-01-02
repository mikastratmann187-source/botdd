// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { serveStatic } from "./static";
import { registerRoutes } from "./routes";
import { startBot } from "./bot"; // <-- bot.ts muss jetzt export function startBot() haben

// ----------------------
// EXPRESS SERVER SETUP
// ----------------------
const app = express();
const httpServer = createServer(app);

// Raw Body für Webhooks oder ähnliche Endpoints
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// ----------------------
// LOG FUNCTION
// ----------------------
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// ----------------------
// SIMPLE HEALTHCHECK
// ----------------------
app.get("/", (_req, res) => res.send("Bot is alive!"));

// ----------------------
// REQUEST LOGGER
// ----------------------
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(logLine);
    }
  });

  next();
});

// ----------------------
// GLOBAL ERROR HANDLING
// ----------------------
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

// ----------------------
// START SERVER & BOT
// ----------------------
(async () => {
  // Register routes
  await registerRoutes(httpServer, app);

  // Express Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // Vite oder Static
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Server starten
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => {
      log(`Server running on port ${port}`);
      try {
        startBot(); // <- Bot wird hier gestartet
        log("Discord bot start attempted", "bot");
      } catch (e) {
        console.error("Error while starting Discord bot:", e);
      }
    }
  );
})();

