import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import Logger from "../utils/logger";
import { env } from "../config/env";

/**
 * A centralized error handling middleware for Express.
 * It catches errors passed through `next(error)` and formats a consistent JSON response.
 *
 * - For instances of `ApiError`, it uses the provided status code and message.
 * - For all other errors, it defaults to a 500 Internal Server Error.
 * - In development mode, it includes the error stack trace in the response.
 */
const errorHandler = (
  err: ApiError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = "Something went wrong";
  let errors: string[] = [];
  let stack = "";

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
    stack = err.stack || "";
  } else {
    // For generic, unhandled errors, log the full error
    Logger.error(err.message);
    // Overwrite message only for generic errors. For ApiError, the message is intentional.
    message = "Internal Server Error";
    stack = err.stack || "";
  }

  const response = {
    success: false,
    message,
    ...(errors.length > 0 && { errors }),
    // Only include the stack trace in development for debugging purposes
    ...(env.NODE_ENV === "development" && { stack }),
  };

  res.status(statusCode).json(response);
};

export { errorHandler };
