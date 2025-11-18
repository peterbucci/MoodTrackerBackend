import { createServer } from "./app.js";
import { config } from "./config/index.js";

const app = createServer();

app.listen(config.PORT, () => {
  const base = config.BASE_URL || `http://localhost:${config.PORT}`;
  console.log(`Server on :${config.PORT}`);
  console.log(`Authorize a user at: ${base}/oauth/start`);
});
