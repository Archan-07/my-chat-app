import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  primaryKey,
  json,
  index,
} from "drizzle-orm/pg-core";

const roleEnum = pgEnum("role", ["ADMIN", "MEMBER"]);

const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(), // Auto-generate UUID
    username: varchar("username", { length: 50 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(), // Hashed passwords need space
    avatar: varchar("avatar", { length: 255 }), // URL to Cloudinary
    avatarPublicId: varchar("avatarPublicId", { length: 255 }),
    isOnline: boolean("is_online").default(false),
    isActive: boolean("is_active").default(true).notNull(),
    refreshToken: text("refreshToken"),
    lastSeen: timestamp("last_seen"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    username_idx: index("username_idx").on(table.username),
    email_idx: index("email_idx").on(table.email),
    refreshToken_idx: index("refreshToken_idx").on(table.refreshToken),
  })
);

const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 50 }).notNull(),
    description: varchar("description", { length: 255 }),
    isGroup: boolean("is_group").default(true),
    roomAvatar: varchar("roomAvatar", { length: 255 }), // URL to Cloudinary
    avatarPublicId: varchar("avatarPublicId", { length: 255 }),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    name_idx: index("name_idx").on(table.name),
    adminId_idx: index("adminId_idx").on(table.adminId),
  })
);

const participants = pgTable(
  "participants",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    role: roleEnum("role").default("MEMBER"),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => ({
    // Composite Primary Key: A user cannot join the same room twice
    pk: primaryKey({ columns: [t.userId, t.roomId] }),
    userId_idx: index("participants_userId_idx").on(t.userId),
    roomId_idx: index("participants_roomId_idx").on(t.roomId),
  })
);

const attachmentTypeEnum = pgEnum("attachment_type", [
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "DOCUMENT",
]);
const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    content: text("content").notNull(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),

    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id),
    attachmentUrl: varchar("attachment_url", { length: 255 }),
    attachmentPublicId: varchar("attachment_public_id", { length: 255 }),
    attachmentType: attachmentTypeEnum("attachment_type").default("IMAGE"),
    urlPreview: json("url_preview"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    senderId_idx: index("senderId_idx").on(table.senderId),
    roomId_createdAt_idx: index("roomId_createdAt_idx").on(
      table.roomId,
      table.createdAt
    ),
  })
);

const readReceipts = pgTable(
  "read_receipts",
  {
    messageId: uuid("message_id")
      .references(() => messages.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    readAt: timestamp("read_at").defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.messageId, t.userId] }),
    messageId_idx: index("read_receipts_messageId_idx").on(t.messageId),
    userId_idx: index("read_receipts_userId_idx").on(t.userId),
  })
);

const userRelation = relations(users, ({ many }) => ({
  roomParticipating: many(participants), // A user is in many rooms
  messages: many(messages), // A user sends many messages
}));

const roomRelation = relations(rooms, ({ one, many }) => ({
  admin: one(users, {
    fields: [rooms.adminId],
    references: [users.id],
  }),
  participants: many(participants),
  messages: many(messages),
}));

const participantsRelation = relations(participants, ({ one }) => ({
  user: one(users, {
    fields: [participants.userId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [participants.roomId],
    references: [rooms.id],
  }),
}));

const messagesRelation = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
}));

export {
  roleEnum,
  users,
  rooms,
  messages,
  participants,
  userRelation,
  roomRelation,
  messagesRelation,
  participantsRelation,
  readReceipts,
  attachmentTypeEnum,
};
