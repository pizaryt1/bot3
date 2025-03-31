import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startBot } from "./discord/bot";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Discord Bot
  try {
    await startBot();
    log("Discord bot started successfully", "discord");
  } catch (error) {
    log(`Failed to start Discord bot: ${error}`, "discord");
    process.exit(1);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Discord bot service needs to be accessible on port 8000
  const botPort = 8000;
  const webPort = 5000;

  // Start the web server on port 5000
  server.listen({
    port: webPort,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Web server listening on port ${webPort}`);
  });
  
  // Use express without the frontend to serve the bot API on port 8000
  const botApp = express();
  botApp.use(express.json());
  
  // Add a simple healthcheck endpoint
  botApp.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'werewolf-bot' });
  });
  
  botApp.listen({
    port: botPort,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`Bot API listening on port ${botPort}`);
  });
})();
