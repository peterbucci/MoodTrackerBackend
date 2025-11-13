import express from "express";
import bodyParser from "body-parser";
import { rawJson } from "./middleware/rawJson.js";
import oauthRoutes from "./routes/oauth.js";
import webhookRoutes from "./routes/webhook.js";
import featuresRoutes from "./routes/features.js";

export function createServer() {
  const app = express();

  // Normal JSON for most routes
  app.use((req, res, next) => {
    if (req.path.startsWith("/fitbit/webhook")) return next();
    return bodyParser.json()(req, res, next);
  });

  // Raw JSON only for webhook signature verification
  app.use("/fitbit/webhook", rawJson);

  // Routes
  app.use(oauthRoutes);
  app.use(webhookRoutes);
  app.use(featuresRoutes);

  return app;
}
