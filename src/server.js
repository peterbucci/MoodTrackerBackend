import { createServer } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";

const app = createServer();

app.listen(config.PORT, () => {
  const base = config.BASE_URL || `http://localhost:${config.PORT}`;
  logger.info(`Server on :${config.PORT}`);
  logger.info(`Authorize a user at: ${base}/oauth/start`);
});
