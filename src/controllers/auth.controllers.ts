import { asyncHandler } from "utils/asyncHandler";
import { Request, Response } from "express";
import { db } from "db";
import { users } from "db/schema";
import { and, eq, ilike, ne, or } from "drizzle-orm";
import { ApiError } from "utils/ApiError";
import { deleteFromCloudinary, uploadOnCloudinary } from "utils/cloudinary";
import bcrypt from "bcrypt";
import { ApiResponse } from "utils/ApiResponse";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "config/env";
import Logger from "utils/logger";
import { get as cacheGet, set as cacheSet, del as cacheDel } from "utils/cache";
interface CustomJwtPayload extends JwtPayload {
  _id: string;
}

const generateAccessRefreshTokens = async (userId: string) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const accessToken = jwt.sign(
      {
        _id: user.id,
        email: user.email,
        username: user.username,
      },
      env.ACCESS_TOKEN_SECRET as jwt.Secret,
      { expiresIn: env.ACCESS_TOKEN_EXPIRY } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      {
        _id: user.id,
      },
      env.REFRESH_TOKEN_SECRET as jwt.Secret,
      { expiresIn: env.REFRESH_TOKEN_EXPIRY } as jwt.SignOptions
    );

    await db
      .update(users)
      .set({ refreshToken: refreshToken })
      .where(eq(users.id, userId));

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Something went wrong while generating tokens");
  }
};

const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  const existingUser = await db
    .select()
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .limit(1);

  if (existingUser.length > 0) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.file?.path;

  let avtarUrl = "";
  let avatarPublicId = "";

  if (avatarLocalPath) {
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (avatar) {
      (avtarUrl = avatar.secure_url), (avatarPublicId = avatar.public_id);
    }
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      username,
      password: hashedPassword,
      avatar: avtarUrl,
      avatarPublicId: avatarPublicId,
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      avatar: users.avatar,
      createdAt: users.createdAt,
    });

  if (!newUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, newUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = req.body;

  const [user] = await db
    .select()
    .from(users)
    .where(username ? eq(users.username, username) : eq(users.email, email));

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessRefreshTokens(
    user.id
  );

  const loggedInUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    isOnline: user.isOnline,
  };

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const loggedOutUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.id) {
    await db
      .update(users)
      .set({ refreshToken: null })
      .where(eq(users.id, req.user.id));
  }
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token required");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      env.REFRESH_TOKEN_SECRET
    ) as CustomJwtPayload;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decodedToken._id))
      .limit(1);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const options = { httpOnly: true, secure: true };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessRefreshTokens(user.id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token refresh successfully"
        )
      );
  } catch (error) {
    Logger.error(`Error refreshing access token: ${(error as Error).message}`);
    throw new ApiError(
      500,
      "Something went wrong while refreshing access token"
    );
  }
});

const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordValid) {
    throw new ApiError(400, "Current password is incorrect");
  }
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ password: hashedNewPassword })
    .where(eq(users.id, userId));

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Password changed successfully"));
});
const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const cacheKeys = `user:profile:${userId}`;

  try {
    const cached = await cacheGet(cacheKeys);
    if (cached) {
      return res
        .status(200)
        .json(
          new ApiResponse(200, cached, "Current user fetched successfully")
        );
    }
  } catch (err) {
    Logger.warn(
      "Cache read failed for getCurrentUser:",
      (err as Error).message
    );
  }

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      avatar: users.avatar,
      createdAt: users.createdAt,
      refreshToken: users.refreshToken,
      isOnline: users.isOnline,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new ApiError(404, "User not found");

  const publicUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    createdAt: user.createdAt,
    isOnline: user.isOnline,
  };

  try {
    await cacheSet(cacheKeys, publicUser, 3600);
  } catch (err) {
    Logger.warn("Cache set failed for getCurrentUser:", (err as Error).message);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, publicUser, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, username } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    if (!email && !username) {
      throw new ApiError(400, "No details provided to update");
    }

    if (email || username) {
      const orConditions = [];
      if (email) orConditions.push(eq(users.email, email));
      if (username) orConditions.push(eq(users.username, username));

      const conflictingUsers = await db
        .select({ email: users.email, username: users.username })
        .from(users)
        .where(and(ne(users.id, userId), or(...orConditions)));

      if (conflictingUsers.length > 0) {
        if (email && conflictingUsers.some((u) => u.email === email)) {
          throw new ApiError(409, "Email is already in use");
        }
        if (username && conflictingUsers.some((u) => u.username === username)) {
          throw new ApiError(409, "Username is already in use");
        }
      }
    }

    const updateData: { email?: string; username?: string } = {};
    if (email) updateData.email = email;
    if (username) updateData.username = username;

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        avatar: users.avatar,
      });

    const cacheKey = `user:profile:${userId}`;
    try {
      if (updatedUser) await cacheSet(cacheKey, updatedUser, 3600);
    } catch (err) {
      Logger.warn(
        "Cache set failed after updateAccountDetails:",
        (err as Error).message
      );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedUser,
          "Account details updated successfully"
        )
      );
  }
);
const updateAvatar = asyncHandler(async (req: Request, res: Response) => {
  const avatarLocalPath = req.file?.path;
  const userId = req.user?.id;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar?.secure_url) {
    throw new ApiError(500, "Error uploading avatar");
  }

  const oldPublicId = req.user?.avatarPublicId;
  if (oldPublicId) {
    deleteFromCloudinary(oldPublicId);
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      avatar: avatar.secure_url,
      avatarPublicId: avatar.public_id,
    })
    .where(eq(users.id, userId!))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      avatar: users.avatar,
    });
  try {
    const cacheKey = `user:profile:${userId}`;
    if (updatedUser) await cacheSet(cacheKey, updatedUser, 3600);
  } catch (err) {
    Logger.warn("Cache set failed after updateAvatar:", (err as Error).message);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Avatar updated successfully"));
});

const deleteUserAccount = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new ApiError(401, "Unauthorized");

  const avatarPublicId = req.user?.avatarPublicId;
  if (avatarPublicId) {
    await deleteFromCloudinary(avatarPublicId);
  }
  await db.delete(users).where(eq(users.id, userId));
  const options = {
    httpOnly: true,
    secure: true,
  };

  const cacheKey = `user:profile:${userId}`;
  try {
    await cacheDel(cacheKey);
  } catch (err) {
    Logger.warn(
      "Cache delete failed after deleteUser:",
      (err as Error).message
    );
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User deleted successfully"));
});

const searchUser = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.query;
  const currentUserId = req.user?.id;

  if (!query || typeof query !== "string") {
    throw new ApiError(400, "Search query is required");
  }

  const foundUsers = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      avatar: users.avatar,
      isOnline: users.isOnline,
    })
    .from(users)
    .where(
      and(
        ne(users.id, currentUserId!),
        or(
          ilike(users.username, `%${query}%`),
          ilike(users.email, `%${query}%`)
        )
      )
    )
    .limit(10);

  return res.status(200).json(new ApiResponse(200, foundUsers, "Users found"));
});
export {
  registerUser,
  loginUser,
  loggedOutUser,
  refreshAccessToken,
  changePassword,
  updateAccountDetails,
  updateAvatar,
  getCurrentUser,
  deleteUserAccount,
  searchUser,
};
