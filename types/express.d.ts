import { Express } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        avatar: string | null;
        avatarPublicId: string | null;
        createdAt: Date | null;
        // Add other fields if needed, but keep it minimal
      };
    }
  }
}

// This empty export is necessary to make this a module
export {};
