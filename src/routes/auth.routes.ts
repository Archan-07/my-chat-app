import {
  changePassword,
  deactivateUserAccount,
  getCurrentUser,
  loggedOutUser,
  loginUser,
  refreshAccessToken,
  registerUser,
  searchUser,
  updateAccountDetails,
  updateAvatar,
} from "../controllers/auth.controllers"; // Check your import paths if you use aliases
import { Router } from "express";
import redisRateLimiter from "../middlewares/redisRateLimiter.middleware";
import { verifyJWT } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/multer.middleware";
import { validate } from "../middlewares/validator.middleware";
import {
  changePasswordSchema,
  updateAccountDetailsSchema,
  userLoginSchema,
  userRegisterSchema,
} from "../validators/auth.validator";

const router = Router();

router
  .route("/login")
  .post(
    upload.none(),
    validate(userLoginSchema),
    redisRateLimiter({ windowSec: 60, max: 8, keyPrefix: "rl:auth:login:" }),
    loginUser
  );

router
  .route("/register")
  .post(
    upload.single("avatar"),
    validate(userRegisterSchema),
    redisRateLimiter({
      windowSec: 60 * 60,
      max: 6,
      keyPrefix: "rl:auth:register:",
    }),
    registerUser
  );

router.route("/refresh-access-token").post(refreshAccessToken);
router.route("/logout").post(verifyJWT, loggedOutUser);

router
  .route("/change-password")
  .post(verifyJWT, validate(changePasswordSchema), changePassword);

router.route("/get-current-user").get(verifyJWT, getCurrentUser);

router
  .route("/update-account-details")
  .put(
    upload.none(),
    verifyJWT,
    validate(updateAccountDetailsSchema),
    updateAccountDetails
  );

router
  .route("/update-avatar")
  .put(verifyJWT, upload.single("avatar"), updateAvatar);

router.route("/delete-user").delete(verifyJWT, deactivateUserAccount);

router.route("/find-user").get(verifyJWT, searchUser);

export default router;
