import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { db } from "../db";
import { rooms, participants, users } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { deleteFromCloudinary, uploadOnCloudinary } from "utils/cloudinary";
import { log } from "node:console";

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
  const newRoom = await db.transaction(async (tx) => {
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
  return res
    .status(201)
    .json(new ApiResponse(201, newRoom, "Room created successfully"));
});

const getMyRooms = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, "User not authenticated");

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
  return res
    .status(200)
    .json(new ApiResponse(200, userRooms, "Rooms fetched successfully"));
});

const getRoomById = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;

  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) throw new ApiError(404, "Room not found");

  const participantsList = await db
    .select({
      userId: users.id,
      username: users.username,
      avatar: users.avatar,
      role: participants.role,
      joinedAt: participants.joinedAt,
    })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.roomId, room.id));

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { ...room, participants: participantsList },
        "Room details fetched"
      )
    );
});

const updateRoomDetails = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { name, description } = req.body;
  const userId = req.user!.id;

  const roomCheck = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.adminId, userId)));

  if (roomCheck.length === 0) {
    throw new ApiError(403, "Room not found or you are not the admin");
  }

  const [updatedRoom] = await db
    .update(rooms)
    .set({ name: name, description: description })
    .where(eq(rooms.id, roomId))
    .returning();

  return res
    .status(200)
    .json(new ApiResponse(200, updatedRoom, "Room updated successfully"));
});

const updateRoomAvatar = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.user!.id;
  const avatarLocalPath = req.file?.path;

  console.log("avatarLocalPath-------------", avatarLocalPath);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const roomCheck = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.adminId, userId)));

  if (roomCheck.length === 0) {
    throw new ApiError(403, "Room not found or you are not the admin");
  }
  const [oldRoom] = roomCheck;
  if (oldRoom.avatarPublicId) {
    deleteFromCloudinary(oldRoom.avatarPublicId);
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar?.secure_url) {
    throw new ApiError(500, "Error uploading avatar");
  }

  const [updatedRoom] = await db
    .update(rooms)
    .set({ roomAvatar: avatar.secure_url, avatarPublicId: avatar.public_id })
    .where(eq(rooms.id, roomId))
    .returning();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Room's avatar is updated"));
});

const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.user!.id;

  const roomCheck = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.adminId, userId)))
    .limit(1);

  if (roomCheck.length === 0) {
    throw new ApiError(403, "Room not found or you are not the admin");
  }

  await db.transaction(async (tx) => {
    await tx.delete(participants).where(eq(participants.roomId, roomId));
    await tx.delete(rooms).where(eq(rooms.id, roomId));
  });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Room deleted successfully"));
});

const addParticipants = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { userToAdd } = req.body;

  const userId = req.user!.id;

  const roomCheck = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.adminId, userId)))
    .limit(1);

  if (roomCheck.length === 0) {
    throw new ApiError(403, "Room not found or you are not the admin");
  }

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
  return res.status(200).json(new ApiResponse(200, {}, "User added to room"));
});

const removeParticipants = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { userToRemove } = req.body;

  const userId = req.user!.id;

  const roomCheck = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.adminId, userId)))
    .limit(1);

  if (roomCheck.length === 0) {
    throw new ApiError(403, "Room not found or you are not the admin");
  }

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

  if ((existingUser.length = 0)) {
    throw new ApiError(400, "User not found");
  }

  await db
    .delete(participants)
    .where(
      and(
        eq(participants.roomId, roomId),
        eq(participants.userId, userToRemove)
      )
    );
  return res.status(200).json(new ApiResponse(200, {}, "User removed from room"));
});

const leaveRoom = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.user?.id!;

  await db
    .delete(participants)
    .where(
      and(eq(participants.roomId, roomId), eq(participants.userId, userId))
    );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Left room successfully"));
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
};
