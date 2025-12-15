import { z } from "zod";

const userRegisterSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  username: z
    .string()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(20, { message: "Username must be at most 20 characters long" })
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters long" }),
});

const userLoginSchema = z
  .object({
    email: z.string().email().optional(),
    username: z.string().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => data.email || data.username, {
    message: "Either email or username is required",
    path: ["username"],
  });

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old Password is required"),
  newPassword: z
    .string()
    .min(6, { message: "New Password must be at least 6 characters long" }),
});

const updateAccountDetailsSchema = z
  .object({
    email: z.string().email({ message: "Invalid email address" }).optional(),
    username: z
      .string()
      .min(3, { message: "Username must be at least 3 characters long" })
      .max(20, { message: "Username must be at most 20 characters long" })
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores"
      )
      .optional(),
  })
  .refine((data) => data.email || data.username, {
    message: "Either email or username must be provided",
    path: ["email"],
  });
export {
  userLoginSchema,
  userRegisterSchema,
  changePasswordSchema,
  updateAccountDetailsSchema,
};
