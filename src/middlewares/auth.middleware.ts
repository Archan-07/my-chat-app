import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import jwt, { JwtPayload } from "jsonwebtoken";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { env } from "config/env";

interface CustomJwtPayload extends JwtPayload {
  _id: string;
}

export const verifyJWT = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "") ||
        req.body?.accessToken;

      if (!token) {
        throw new ApiError(401, "Unauthorized request");
      }
      const decodedToken = jwt.verify(
        token,
        env.ACCESS_TOKEN_SECRET!
      ) as CustomJwtPayload;

      const userResult = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          avatar: users.avatar,
          avatarPublicId: users.avatarPublicId,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, decodedToken._id))
        .limit(1);
      if (userResult.length === 0) {
        throw new ApiError(401, "Invalid Access Token");
      }

      // Attach to request object
      req.user = userResult[0];

      next();
    } catch (error: any) {
      throw new ApiError(401, error?.message || "Invalid access token");
    }
  }
);
