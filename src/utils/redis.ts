import { createClient } from "redis";
import { env } from "config/env";
import Logger from "./logger";

const redisClient = createClient({ url: env.REDIS_URL });

redisClient.on("error", (err) => {
  Logger.error("Redis Client Error", err);
});

(async () => {
  await redisClient.connect();
})();

export { redisClient };
