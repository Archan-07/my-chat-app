import { app } from "./app";
import { env } from "config/env";
import { db } from "./db/index"; // Drizzle Instance
import { sql } from "drizzle-orm";
import Logger from "./utils/logger";
import { createServer } from "http";
import { Server } from "socket.io";
import { initializeSocketIO } from "./socket";

const PORT = env.PORT;
// const numCPUs = os.cpus().length;

const startServer = async () => {
  try {
    // 1. Check Database
    await db.execute(sql`SELECT 1`);
    Logger.info("🐘 PostgreSQL Connected successfully via Drizzle");

    // 2. Create HTTP Server
    const httpServer = createServer(app);

    // 3. Initialize Socket.io
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        credentials: true,
      },
    });

    await initializeSocketIO(io);
    app.set("io", io);

    // 4. Listen
    httpServer.listen(PORT, () => {
      Logger.info(`🚀 Server is running on Port: ${PORT}`);
    });
  } catch (err) {
    Logger.error(`Failed to start server: ${err}`);
    process.exit(1);
  }
};

startServer();
