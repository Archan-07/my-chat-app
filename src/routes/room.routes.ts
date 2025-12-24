import {
  addParticipants,
  createOrGetOneOnOneChat,
  createRoom,
  deleteRoom,
  getMyRooms,
  getRoomById,
  leaveRoom,
  removeParticipants,
  searchRooms,
  updateRoomAvatar,
  updateRoomDetails,
} from "controllers/room.controllers";
import { Router } from "express";
import { verifyJWT } from "middlewares/auth.middleware";
import { upload } from "middlewares/multer.middleware";
import { validate } from "middlewares/validator.middleware";
import { createRoomSchema, updateRoomSchema } from "validators/room.validator";

import { isRoomAdmin } from "middlewares/roomAdmin.middleware";

const router = Router();

router
  .route("/create-room")
  .post(
    verifyJWT,
    upload.single("roomAvatar"),
    validate(createRoomSchema),
    createRoom
  );

router.route("/get-rooms").get(verifyJWT, getMyRooms);
router.route("/search").get(verifyJWT, searchRooms);

router
  .route("/:roomId")
  .get(getRoomById)
  .patch(
    verifyJWT,
    isRoomAdmin,
    upload.none(),
    validate(updateRoomSchema),
    updateRoomDetails
  )
  .delete(verifyJWT, isRoomAdmin, deleteRoom);

router
  .route("/update-room-avatar/:roomId")
  .patch(verifyJWT, isRoomAdmin, upload.single("roomAvatar"), updateRoomAvatar);

// Participant Management
router
  .route("/add-participants/:roomId")
  .post(verifyJWT, isRoomAdmin, upload.none(), addParticipants);
router
  .route("/remove-participants/:roomId")
  .post(verifyJWT, isRoomAdmin, upload.none(), removeParticipants);
router.route("/leave/:roomId").post(verifyJWT, leaveRoom);
router.route("/dm/:receiverId").post(verifyJWT, createOrGetOneOnOneChat);

export default router;
