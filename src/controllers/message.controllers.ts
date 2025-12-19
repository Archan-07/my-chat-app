import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { db } from "../db";
import { messages, rooms, users } from "../db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { ApiError } from "utils/ApiError";
import { deleteFromCloudinary, uploadOnCloudinary } from "utils/cloudinary";

const getRoomMessages = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;

  const history = await db
    .select({
      id: messages.id,
      content: messages.content,
      createdAt: messages.createdAt,
      sender: {
        id: users.id,
        username: users.username,
        avatar: users.avatar,
      },
    })
    .from(messages)
    .innerJoin(users, eq(messages.senderId, users.id))
    .where(eq(messages.roomId, roomId))
    .orderBy(asc(messages.createdAt))
    .limit(50);

  const sortedHistory = history.reverse();
  return res
    .status(200)
    .json(new ApiResponse(200, sortedHistory, "Messages fetched"));
});

const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { content } = req.body;
  const userId = req.user?.id;
  const localFilePath = req.file?.path;

  if (!content && !localFilePath) {
    throw new ApiError(400, "Message must have content or attachment");
  }

  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }

  let attachmentUrl = "";
  let attachmentPublicId = "";

  if (localFilePath) {
    const upload = await uploadOnCloudinary(localFilePath);
    if (upload) {
      attachmentUrl = upload.secure_url;
      attachmentPublicId = upload.public_id;
    } else {
      throw new ApiError(500, "Attachment upload failed");
    }
  }

  const [savedMessage] = await db
    .insert(messages)
    .values({
      content: content || "", // Content can be empty if sending just image
      roomId,
      senderId: userId,
      attachmentUrl,
      attachmentPublicId,
    })
    .returning();

  const [senderInfo] = await db
    .select({
      id: users.id,
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, userId));

  const socketPayload = {
    ...savedMessage,
    sender: senderInfo,
  };

  const io = req.app.get("io");
  io.to(roomId).emit("receive_message", socketPayload);

  return res
    .status(201)
    .json(new ApiResponse(201, socketPayload, "Message sent"));
});
const deleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const { messageId, roomId } = req.params;
  const userId = req.user?.id!;

  const msgCheck = await db
    .select()
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.roomId, roomId)))
    .limit(1);

  const [room] = await db
    .select({ adminId: rooms.adminId })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  if (!room) {
    throw new ApiError(404, "Room not found");
  }

  if (msgCheck.length === 0) throw new ApiError(404, "Message not found");
  const msg = msgCheck[0];
  const isAdmin = room.adminId === userId;
  const isOwner = msg.senderId === userId;
  // .where(and(eq(messages.id, messageId), eq(messages.roomId, roomId)));

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You can only delete your own messages");
  }

  if (msg.attachmentPublicId) {
    await deleteFromCloudinary(msg.attachmentPublicId);
  }

  await db.delete(messages).where(eq(messages.id, messageId));

  // Notify Room via Socket
  const io = req.app.get("io");
  io.to(roomId).emit("message_deleted", { messageId });

  return res.status(200).json(new ApiResponse(200, {}, "Message deleted"));
});

export { getRoomMessages, sendMessage, deleteMessage };
