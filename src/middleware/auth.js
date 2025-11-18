import { config } from "../config/index.js";

export function requireApiKey(req, res, next) {
  const key = req.get("x-api-key");
  if (!key || key !== config.API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
