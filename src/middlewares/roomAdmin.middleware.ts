import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { db } from "../db";
import { rooms } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const isRoomAdmin = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { roomId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "User not authenticated");
    }

    if (!roomId) {
      throw new ApiError(400, "Room ID is required");
    }

    const [room] = await db
      .select({ adminId: rooms.adminId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (!room) {
      throw new ApiError(404, "Room not found");
    }

    if (room.adminId !== userId) {
      throw new ApiError(403, "You are not the admin of this room");
    }

    next();
  }
);
