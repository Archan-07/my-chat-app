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
} from "drizzle-orm/pg-core";

const roleEnum = pgEnum("role", ["ADMIN", "MEMBER"]);

const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(), // Auto-generate UUID
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(), // Hashed passwords need space
  avatar: varchar("avatar", { length: 255 }), // URL to Cloudinary
  avatarPublicId: varchar("avatarPublicId", { length: 255 }),
  isOnline: boolean("is_online").default(false),
  refreshToken: text("refreshToken"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
  description: varchar("description", { length: 255 }),
  isGroup: boolean("is_group").default(true),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  })
);

const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  content: text("content").notNull(),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id),

  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
};
