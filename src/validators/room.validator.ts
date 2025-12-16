import z from "zod";

const createRoomSchema = z.object({
  name: z.string().min(3, "Room name must be at least 3 characters").max(50),
  description: z.string().max(100).optional(),
  isGroup: z.boolean().default(true),
});

const updateRoomSchema = z.object({
  name: z.string().min(3, "Room name must be at least 3 characters").max(50),
  description: z.string().max(100).optional(),
});

export { createRoomSchema, updateRoomSchema};
