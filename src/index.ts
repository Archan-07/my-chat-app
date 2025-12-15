import { app } from "./app";
import { env } from "config/env";
import { db } from "./db/index"; // Drizzle Instance
import { sql } from "drizzle-orm";
import cluster from "node:cluster";
import os from "node:os";
import Logger from "./utils/logger";

const PORT = env.PORT;
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  Logger.info(`Primary ${process.pid} is running`);

  // Fork workers based on CPU cores
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    Logger.warn(`Worker ${worker.process.pid} died. Forking a new one...`);
    cluster.fork();
  });
} else {
  // WORKER PROCESS
  const startServer = async () => {
    try {
      // 1. Test Database Connection (Optional but recommended)
      // We run a simple query to ensure Postgres is alive
      await db.execute(sql`SELECT 1`);
      Logger.info("🐘 PostgreSQL Connected successfully via Drizzle");

      // 2. Start Express Server
      app.listen(PORT, () => {
        Logger.info(`Worker ${process.pid} listening on Port: ${PORT}`);
      });
    } catch (err) {
      Logger.error(`Worker ${process.pid} failed to start: ${err}`);
      process.exit(1);
    }
  };

  startServer();
}
