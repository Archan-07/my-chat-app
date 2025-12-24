import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { db } from "../db";
import { rooms, participants, users } from "../db/schema";
import { eq, desc, and, sql, ilike } from "drizzle-orm";
import { deleteFromCloudinary, uploadOnCloudinary } from "utils/cloudinary";
import { get as cacheGet, set as cacheSet, del as cacheDel } from "utils/cache";
import Logger from "utils/logger";
import { alias } from "drizzle-orm/pg-core";

const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, isGroup } = req.body;
  const userId = req.user?.id;

  const avatarLocalPath = req.file?.path;

  let avtarUrl = "";
  let avatarPublicId = "";
  if (avatarLocalPath) {
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar?.secure_url) {
      throw new ApiError(500, "Error uploading avatar");
    }
    if (avatar) {
      avtarUrl = avatar.secure_url;
      avatarPublicId = avatar.public_id;
    }
  }
  if (!userId) throw new ApiError(401, "User not authenticated");
  let newRoom;
  try {
    newRoom = await db.transaction(async (tx) => {
      const [room] = await tx
        .insert(rooms)
        .values({
          name,
          description,
          isGroup: isGroup ?? true,
          adminId: userId,
          roomAvatar: avtarUrl,
          avatarPublicId: avatarPublicId,
        })
        .returning();

      await tx.insert(participants).values({
        roomId: room.id,
        userId: userId,
        role: "ADMIN",
      });
      return room;
    });
  } catch (error) {
    if (avatarPublicId) {
      await deleteFromCloudinary(avatarPublicId);
    }
    throw error;
  }

  try {
    const cacheKey = `user:rooms:${userId}`;
    await cacheDel(cacheKey);
  } catch (err) {
    Logger.warn(
      "Cache delete failed for user's room list after creating a room:",
      (err as Error).message
    );
  }

  return res
    .status(201)
    .json(new ApiResponse(201, newRoom, "Room created successfully"));
});

const getMyRooms = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, "User not authenticated");
  const cacheKey = `user:rooms:${userId}`;

  try {
    const cached = await cacheGet(cacheKey);

    if (cached) {
      return res
        .status(200)
        .json(new ApiResponse(200, cached, "Rooms fetched successfully"));
    }
  } catch (err) {
    Logger.warn("Cache read failed for getMyRooms:", (err as Error).message);
  }

  const userRooms = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      description: rooms.description,
      isGroup: rooms.isGroup,
      avatar: rooms.roomAvatar,
      role: participants.role,
      joinedAt: participants.joinedAt,
    })
    .from(participants)
    .innerJoin(rooms, eq(participants.roomId, rooms.id))
    .where(eq(participants.userId, userId))
    .orderBy(desc(participants.joinedAt));

  try {
    await cacheSet(cacheKey, userRooms, 600);
  } catch (err) {
    Logger.warn("Cache set failed for getMyRooms:", (err as Error).message);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, userRooms, "Rooms fetched successfully"));
});

const getRoomById = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;

  const cacheRoomKey = `room:meta:${roomId}`;
  const cacheParticipantKey = `room:participants:${roomId}`;

  let roomData: typeof rooms.$inferSelect | undefined | null;
  let participantsList: any[] | undefined | null;

  try {
    roomData = await cacheGet<typeof rooms.$inferSelect>(cacheRoomKey);
    participantsList = await cacheGet<any[]>(cacheParticipantKey);
  } catch (err) {
    Logger.warn("Cache read failed for getRoomById:", (err as Error).message);
  }

  if (!roomData) {
    [roomData] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  }

  if (!roomData) throw new ApiError(404, "Room not found");

  try {
    await cacheSet(cacheRoomKey, roomData, 3600);
  } catch (err) {
    Logger.warn(
      "Cache set for room metadata failed in getRoomById:",
      (err as Error).message
    );
  }

  if (!participantsList) {
    participantsList = await db
      .select({
        userId: users.id,
        username: users.username,
      })
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .where(eq(participants.roomId, roomId));
  }

  try {
    await cacheSet(cacheParticipantKey, participantsList, 1800);
  } catch (err) {
    Logger.warn(
      "Cache set for participants failed in getRoomById:",
      (err as Error).message
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { ...roomData, participants: participantsList },
        "Room details fetched"
      )
    );
});

const updateRoomDetails = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { name, description } = req.body;

  const [updatedRoom] = await db
    .update(rooms)
    .set({ name: name, description: description, updatedAt: new Date() })
    .where(eq(rooms.id, roomId))
    .returning();

  const roomParticipants = await db
    .select({ userId: participants.userId })
    .from(participants)
    .where(eq(participants.roomId, roomId));

  const cacheKey = `room:meta:${roomId}`;

  try {
    const cachePromise = [
      cacheSet(cacheKey, updatedRoom, 3600),
      ...roomParticipants.map((p) => cacheDel(`user:rooms:${p.userId}`)),
    ];
    await Promise.all(cachePromise);
  } catch (err) {
    Logger.warn(
      "Cache set failed for updateRoomDetails:",
      (err as Error).message
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedRoom, "Room updated successfully"));
});

const updateRoomAvatar = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const [oldRoom] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId));

  if (!oldRoom) {
    throw new ApiError(404, "Room not found");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar?.secure_url) {
    throw new ApiError(500, "Error uploading avatar");
  }

  const [updatedRoom] = await db
    .update(rooms)
    .set({
      roomAvatar: avatar.secure_url,
      avatarPublicId: avatar.public_id,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, roomId))
    .returning();

  const roomParticipants = await db
    .select({ userId: participants.userId })
    .from(participants)
    .where(eq(participants.roomId, roomId));

  const cacheKey = `room:meta:${roomId}`;

  try {
    const cachePromise = [
      cacheSet(cacheKey, updatedRoom, 3600),
      ...roomParticipants.map((p) => cacheDel(`user:rooms:${p.userId}`)),
    ];

    await Promise.all(cachePromise);
  } catch (err) {
    Logger.warn(
      "Cache set failed for updateRoomAvatar:",
      (err as Error).message
    );
  }

  if (oldRoom.avatarPublicId) {
    // delete the old avatar after the new one has been successfully uploaded and db updated
    deleteFromCloudinary(oldRoom.avatarPublicId);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Room's avatar is updated"));
});

const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;

  const roomParticipants = await db
    .select({ userId: participants.userId })
    .from(participants)
    .where(eq(participants.roomId, roomId));

  await db.transaction(async (tx) => {
    await tx.delete(participants).where(eq(participants.roomId, roomId));
    await tx.delete(rooms).where(eq(rooms.id, roomId));
  });

  const cacheKey = `room:meta:${roomId}`;
  const participantCacheKey = `room:participants:${roomId}`;

  try {
    const cachePromise = [
      cacheDel(cacheKey),
      cacheDel(participantCacheKey),
      ...roomParticipants.map((p) => cacheDel(`user:rooms:${p.userId}`)),
    ];
    await Promise.all(cachePromise);
  } catch (err) {
    Logger.warn("Cache delete failed for deleteRoom:", (err as Error).message);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Room deleted successfully"));
});

const addParticipants = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { userToAdd } = req.body;

  const existingUser = await db
    .select()
    .from(participants)
    .where(
      and(eq(participants.roomId, roomId), eq(participants.userId, userToAdd))
    )
    .limit(1);

  if (existingUser.length > 0) {
    throw new ApiError(400, "User is already in this room");
  }

  await db.insert(participants).values({
    roomId: roomId,
    userId: userToAdd,
    role: "MEMBER",
  });

  const cacheKey = `room:participants:${roomId}`;
  const userCacheKey = `user:rooms:${userToAdd}`;

  try {
    await cacheDel(cacheKey);
    await cacheDel(userCacheKey);
  } catch (err) {
    Logger.error("Failed to delete participants cache in addParticipants", err);
  }

  return res.status(200).json(new ApiResponse(200, {}, "User added to room"));
});

const removeParticipants = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { userToRemove } = req.body;

  const existingUser = await db
    .select()
    .from(participants)
    .where(
      and(
        eq(participants.roomId, roomId),
        eq(participants.userId, userToRemove)
      )
    )
    .limit(1);
  if (existingUser.length === 0) {
    throw new ApiError(404, "User not found in this room");
  }

  await db
    .delete(participants)
    .where(
      and(
        eq(participants.roomId, roomId),
        eq(participants.userId, userToRemove)
      )
    );

  const cacheKey = `room:participants:${roomId}`;
  const userCacheKey = `user:rooms:${userToRemove}`;

  try {
    await cacheDel(cacheKey);
    await cacheDel(userCacheKey);
  } catch (err) {
    Logger.error("Failed to delete cache in removeParticipants", err);
  }
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "User removed from room"));
});

const leaveRoom = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.user?.id!;

  await db.transaction(async (tx) => {
    const [currentUserParticipant] = await tx
      .select()
      .from(participants)
      .where(
        and(eq(participants.roomId, roomId), eq(participants.userId, userId))
      )
      .limit(1);
    if (!currentUserParticipant) {
      return;
    }

    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);

    if (room.isGroup && currentUserParticipant.role === "ADMIN") {
      const adminCount = await tx
        .select({ count: sql<number>`count(*)` })
        .from(participants)
        .where(
          and(eq(participants.roomId, roomId), eq(participants.role, "ADMIN"))
        );

      if (adminCount[0].count === 1) {
        const [longestStayingMember] = await db
          .select({ id: participants.userId })
          .from(participants)
          .where(
            and(
              eq(participants.roomId, roomId),
              eq(participants.role, "MEMBER")
            )
          )
          .orderBy(participants.joinedAt)
          .limit(1);

        if (longestStayingMember) {
          await tx
            .update(participants)
            .set({ role: "ADMIN" })
            .where(eq(participants.userId, longestStayingMember.id));
        }
      }
    }

    await tx
      .delete(participants)
      .where(eq(participants.userId, currentUserParticipant.userId));
  });
  const cacheKey = `room:participants:${roomId}`;
  const userCacheKey = `user:rooms:${userId}`;

  try {
    await cacheDel(cacheKey);
    await cacheDel(userCacheKey);
  } catch (err) {
    Logger.error("Failed to delete cache in leaveRoom", err);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Left room successfully"));
});

const createOrGetOneOnOneChat = asyncHandler(
  async (req: Request, res: Response) => {
    const { receiverId } = req.params;
    const senderId = req.user?.id;

    if (!senderId) throw new ApiError(401, "User not authenticated");
    if (!receiverId) throw new ApiError(400, "Receiver ID is required");
    if (senderId === receiverId)
      throw new ApiError(400, "Cannot chat with yourself");

    const sortedUserIds = [senderId, receiverId].sort();
    const cacheKey = `one-on-one:${sortedUserIds[0]}:${sortedUserIds[1]}`;

    try {
      const cachedRoom = await cacheGet(cacheKey);
      if (cachedRoom) {
        return res
          .status(200)
          .json(new ApiResponse(200, cachedRoom, "Chat retrieved from cache"));
      }
    } catch (err) {
      Logger.warn(
        "Cache read failed for createOrGetOneOnOneChat:",
        (err as Error).message
      );
    }

    const p1 = alias(participants, "p1");
    const p2 = alias(participants, "p2");

    const [existingRoomData] = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        description: rooms.description,
        isGroup: rooms.isGroup,
        roomAvatar: rooms.roomAvatar,
        adminId: rooms.adminId,
        createdAt: rooms.createdAt,
        updatedAt: rooms.updatedAt,
      })
      .from(rooms)
      .innerJoin(p1, eq(rooms.id, p1.roomId))
      .innerJoin(p2, eq(rooms.id, p2.roomId))
      .where(
        and(
          eq(rooms.isGroup, false),
          eq(p1.userId, senderId),
          eq(p2.userId, receiverId)
        )
      )
      .limit(1);

    if (existingRoomData) {
      try {
        await cacheSet(cacheKey, existingRoomData, 3600); // Cache for 1 hour
      } catch (err) {
        Logger.warn(
          "Cache set failed for existing one-on-one chat:",
          (err as Error).message
        );
      }
      return res
        .status(200)
        .json(
          new ApiResponse(200, existingRoomData, "Chat retrieved successfully")
        );
    }

    const newRoom = await db.transaction(async (tx) => {
      const [room] = await tx
        .insert(rooms)
        .values({
          name: "one-to-one",
          adminId: senderId!,
          isGroup: false,
        })
        .returning();

      await tx.insert(participants).values([
        { roomId: room.id, userId: senderId!, role: "ADMIN" },
        { roomId: room.id, userId: receiverId!, role: "MEMBER" },
      ]);
      return room;
    });

    try {
      await cacheSet(cacheKey, newRoom, 3600);
      // Invalidate the room lists for both users so they can see the new chat
      await cacheDel(`user:rooms:${senderId}`);
      await cacheDel(`user:rooms:${receiverId}`);
    } catch (err) {
      Logger.warn(
        "Cache set/del failed for new one-on-one chat:",
        (err as Error).message
      );
    }

    return res
      .status(201)
      .json(new ApiResponse(201, newRoom, "1-on-1 Chat created successfully"));
  }
);

const searchRooms = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    throw new ApiError(400, "Search query is required");
  }

  const cacheKey = `search:rooms:${query}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res
        .status(200)
        .json(new ApiResponse(200, cached, "Rooms found (from cache)"));
    }
  } catch (err) {
    Logger.warn("Cache read failed for searchRooms:", (err as Error).message);
  }

  const foundRooms = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      description: rooms.description,
      avatar: rooms.roomAvatar,
      isGroup: rooms.isGroup,
    })
    .from(rooms)
    .where(and(eq(rooms.isGroup, true), ilike(rooms.name, `%${query}%`)))
    .limit(20);

  try {
    await cacheSet(cacheKey, foundRooms, 300);
  } catch (err) {
    Logger.warn("Cache set failed for searchRooms:", (err as Error).message);
  }

  return res.status(200).json(new ApiResponse(200, foundRooms, "Rooms found"));
});

export {
  createRoom,
  getMyRooms,
  getRoomById,
  updateRoomAvatar,
  updateRoomDetails,
  deleteRoom,
  addParticipants,
  removeParticipants,
  leaveRoom,
  createOrGetOneOnOneChat,
  searchRooms,
};
