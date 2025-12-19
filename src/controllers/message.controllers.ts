import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { db } from "../db";
import { messages, readReceipts, rooms, users } from "../db/schema";
import { eq, desc, asc, and, sql, isNotNull, ne, isNull } from "drizzle-orm";
import { ApiError } from "utils/ApiError";
import { deleteFromCloudinary, uploadOnCloudinary } from "utils/cloudinary";
import { getLinkPreview } from "utils/linkPreview";

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

  let urlPreview = null;
  if (content) {
    urlPreview = await getLinkPreview(content);
  }

  const [savedMessage] = await db
    .insert(messages)
    .values({
      content: content || "", // Content can be empty if sending just image
      roomId,
      senderId: userId,
      attachmentUrl,
      attachmentPublicId,
      urlPreview: urlPreview,
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

const markMessagesAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.user!.id;

  // 1. Find messages in the room NOT sent by this user
  // 2. That do NOT already have a read receipt for this user
  const unreadMessages = await db
    .select({ id: messages.id })
    .from(messages)
    .leftJoin(
      readReceipts,
      and(
        eq(messages.id, readReceipts.messageId),
        eq(readReceipts.userId, userId)
      )
    )
    .where(
      and(
        eq(messages.roomId, roomId),
        ne(messages.senderId, userId),
        isNull(readReceipts.messageId)
      )
    );

  if (unreadMessages.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "No new messages to mark"));
  }

  const insertData = unreadMessages.map(({ id }) => ({
    messageId: id,
    userId,
  }));

  await db.insert(readReceipts).values(insertData);

  const io = req.app.get("io");
  io.to(roomId).emit("messages_read", {
    roomId,
    readByUserId: userId,
    messageIds: unreadMessages.map((m) => m.id),
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { markedCount: unreadMessages.length },
        "Messages marked as read"
      )
    );
});

export { getRoomMessages, sendMessage, deleteMessage, markMessagesAsRead };
