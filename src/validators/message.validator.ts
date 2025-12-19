import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z
    .string()
    .max(1000, "Message cannot exceed 1000 characters")
    .optional(), // Optional because user might send ONLY an image
});
