import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import helmet from "helmet";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
});

// --- Core Middleware ---
app.use(morgan("dev"));
app.use(helmet()); // Adds security headers
app.use(limiter);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: "16kb",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "16kb",
  })
);

app.use(express.static("public"));
app.use(cookieParser());

// --- Routes ---
import authRouter from "./routes/auth.routes";
import roomRouter from "./routes/room.routes";
import messageRouter from "./routes/message.route";

// Swagger API documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use("/api/v1/users", authRouter);
app.use("/api/v1/rooms", roomRouter);
app.use("/api/v1/messages", messageRouter);

// --- Error Handling Middleware ---
// This must be the last middleware to catch all errors
app.use(errorHandler);

export { app };
