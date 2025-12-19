import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware";
import {
  deleteMessage,
  getRoomMessages,
  markMessagesAsRead,
  sendMessage,
} from "controllers/message.controllers";
import { sendMessageSchema } from "validators/message.validator";
import { validate } from "middlewares/validator.middleware";
import { upload } from "middlewares/multer.middleware";

const router = Router();

router.use(verifyJWT);
router.route("/:roomId").get(getRoomMessages);
router
  .route("/send-message/:roomId")
  .post(
    verifyJWT,
    upload.single("attachment"),
    validate(sendMessageSchema),
    sendMessage
  );

router.route("/delete-message/:messageId/:roomId").delete(deleteMessage);
router.route("/mark-read/:roomId").post(verifyJWT, markMessagesAsRead);
export default router;
