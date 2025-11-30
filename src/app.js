import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { rawJson } from "./middleware/rawJson.js";
import { requireApiKey } from "./middleware/auth.js";
import oauthRoutes from "./routes/oauth.js";
import webhookRoutes from "./routes/webhook.js";
import featuresRoutes from "./routes/features.js";
import requestRoutes from "./routes/requests.js";
import fitbitProxyRouter from "./routes/fitbitProxy.js";
import desktopRoutes from "./routes/desktop.js";
import { config } from "./config/index.js";

export function createServer() {
  const app = express();

  // Allow Expo web dev origin
  app.use(
    cors({
      origin: config.ORIGIN,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    })
  );

  // Normal JSON for most routes
  app.use((req, res, next) => {
    if (req.path.startsWith("/fitbit/webhook")) return next();
    return bodyParser.json()(req, res, next);
  });

  // --- PUBLIC ROUTES

  // Raw JSON only for webhook signature verification
  app.use("/fitbit/webhook", rawJson);

  app.use(webhookRoutes);
  app.use(oauthRoutes);

  // --- PROTECTED ROUTES (everything else)
  app.use(requireApiKey);

  // Your authenticated routes
  app.use(featuresRoutes);
  app.use(requestRoutes);
  app.use(fitbitProxyRouter);
  app.use(desktopRoutes);

  return app;
}
