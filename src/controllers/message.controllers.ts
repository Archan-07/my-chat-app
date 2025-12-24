import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { db } from "../db";
import { messages, readReceipts, rooms, users } from "../db/schema";
import { eq, desc, asc, and, sql, isNotNull, ne, isNull } from "drizzle-orm";
import { ApiError } from "utils/ApiError";
import { deleteFromCloudinary, uploadOnCloudinary } from "utils/cloudinary";
import { getLinkPreview } from "utils/linkPreview";
import { get as cacheGet, set as cacheSet, del as cacheDel } from "utils/cache";
import Logger from "utils/logger";

const getRoomMessages = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;

  const cacheKey = `messages:${roomId}`;

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res
        .status(200)
        .json(new ApiResponse(200, cached, "Messages fetched"));
    }
  } catch (error) {
    Logger.error("Failed to get cached message in getRoomMessages", error);
  }

  const subquery = db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.roomId, roomId))
    .orderBy(desc(messages.createdAt))
    .limit(50)
    .as("latest_messages");

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
      urlPreview: messages.urlPreview,
      attachmentUrl: messages.attachmentUrl,
    })
    .from(messages)
    .innerJoin(subquery, eq(messages.id, subquery.id))
    .innerJoin(users, eq(messages.senderId, users.id))
    .orderBy(asc(messages.createdAt));

  try {
    await cacheSet(cacheKey, history, 1800);
  } catch (error) {
    Logger.error("Failed to set cache in getRoomMessages", error);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, history, "Messages fetched"));
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
      content: content || "",
      roomId,
      senderId: userId,
      attachmentUrl,
      attachmentPublicId,
      urlPreview: urlPreview,
    })
    .returning();

  // Caching opportunity:
  // User data (username, avatar) does not change often and can be cached.
  // A good cache key would be `user:${userId}`.
  // This would avoid a database query on every message sent.
  const [senderInfo] = await db
    .select({
      id: users.id,
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, userId));

  const cacheKey = `user:${userId}`;

  try {
    await cacheSet(cacheKey, senderInfo, 3600);
  } catch (error) {
    Logger.error("Failed to set cache in sendMessage", error);
  }

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
  const cacheKey = `messages:${roomId}`;

  // The two database queries are independent, so they can be run in parallel.
  const [msgResult, roomResult] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.roomId, roomId)))
      .limit(1),
    db
      .select({ adminId: rooms.adminId })
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1),
  ]);

  if (msgResult.length === 0) {
    throw new ApiError(404, "Message not found");
  }

  if (roomResult.length === 0) {
    throw new ApiError(404, "Room not found");
  }

  const msg = msgResult[0];
  const room = roomResult[0];

  const isAdmin = room.adminId === userId;
  const isOwner = msg.senderId === userId;

  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You can only delete your own messages");
  }

  await cacheDel(cacheKey)

  if (msg.attachmentPublicId) {
    await deleteFromCloudinary(msg.attachmentPublicId);
  }

  await db.delete(messages).where(eq(messages.id, messageId));

  const io = req.app.get("io");
  io.to(roomId).emit("message_deleted", { messageId });

  return res.status(200).json(new ApiResponse(200, {}, "Message deleted"));
});

const markMessagesAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.user!.id;

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
