import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users, messages } from "../db/schema";
import { eq } from "drizzle-orm";
import Logger from "../utils/logger";
import { env } from "../config/env";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

interface CustomSocket extends Socket {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

const pubClient = createClient({ url: env.REDIS_URL });
const subClient = pubClient.duplicate();

const initializeSocketIO = async (io: Server) => {
  // connect redis clients and set adapter before handlers
  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    Logger.info("🔁 Redis adapter connected for Socket.IO");
  } catch (err) {
    Logger.warn(
      "⚠️ Could not connect Redis adapter for Socket.IO, continuing without adapter",
      err
    );
  }

  // 1. MIDDLEWARE
  io.use(async (socket: CustomSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");
      if (!token) {
        return next(new Error("Unauthorized: No token provided"));
      }

      const decodeToken = jwt.verify(token, env.ACCESS_TOKEN_SECRET!) as any;

      const userResult = await db
        .select({ id: users.id, username: users.username, email: users.email })
        .from(users)
        .where(eq(users.id, decodeToken._id))
        .limit(1);

      if (userResult.length === 0) {
        return next(new Error("Unauthorized: Invalid user"));
      }

      socket.user = userResult[0];
      next();
    } catch (error) {
      return next(new Error("Unauthorized: Invalid token"));
    }
  });

  // 2. CONNECTION
  io.on("connection", async (socket: CustomSocket) => {
    const userId = socket.user?.id;
    Logger.info(`🔌 User Connected: ${socket.user?.username} (${socket.id})`);

    // A. Handle Online Status
    if (userId) {
      await db
        .update(users)
        .set({ isOnline: true })
        .where(eq(users.id, userId));
      io.emit("user_online", { userId: userId });
    }

    // B. Join Room
    socket.on("join-room", (data: { roomId: string } | string) => {
      const roomId = typeof data === "object" ? data.roomId : data;

      if (!roomId) {
        Logger.warn(`User ${socket.user?.username} tried to join empty room`);
        return;
      }

      socket.join(roomId);
      Logger.info(`User ${socket.user?.username} joined room: ${roomId}`);

      const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      Logger.info(`👥 Room ${roomId} now has ${roomSize} active member(s)`);
    });

    socket.on("typing", (data: { roomId: string } | string) => {
      const roomId = typeof data === "object" ? data.roomId : data;

      Logger.info(`✍️ Typing event received for room: ${roomId}`);
      socket.to(roomId).emit("display_typing", {
        userId: socket.user?.id,
        username: socket.user?.username,
      });
    });

    socket.on("stop_typing", (data: { roomId: string } | string) => {
      const roomId = typeof data === "object" ? data.roomId : data;
      socket.to(roomId).emit("hide_typing", {
        userId: socket.user?.id,
      });
    });

    // D. Send Message
    socket.on(
      "send-message",
      async (data: { roomId: string; content: string }) => {
        const { roomId, content } = data;

        if (!roomId || !content) return;

        try {
          const [savedMessage] = await db
            .insert(messages)
            .values({ content, roomId, senderId: socket.user?.id! })
            .returning();

          const messagePayload = {
            ...savedMessage,
            sender: {
              id: socket.user?.id,
              username: socket.user?.username,
              email: socket.user?.email,
            },
          };

          io.to(roomId).emit("receive_message", messagePayload);
        } catch (error) {
          Logger.error(`Socket Error: ${error}`);
        }
      }
    );

    // E. Disconnect
    socket.on("disconnect", async () => {
      if (userId) {
        await db
          .update(users)
          .set({ isOnline: false, lastSeen: new Date() })
          .where(eq(users.id, userId));

        io.emit("user_offline", { userId: userId, lastSeen: new Date() });
      }
      Logger.info(`❌ User Disconnected: ${socket.user?.username}`);
    });
  });
};

// end initializeSocketIO

export { initializeSocketIO };
