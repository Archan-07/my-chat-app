import {
  changePassword,
  deleteUserAccount,
  getCurrentUser,
  loggedOutUser,
  loginUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateAvatar,
} from "controllers/auth.controllers";
import { Router } from "express";
import { verifyJWT } from "middlewares/auth.middleware";
import { upload } from "middlewares/multer.middleware";
import { validate } from "middlewares/validator.middleware";
import {
  changePasswordSchema,
  updateAccountDetailsSchema,
  userLoginSchema,
  userRegisterSchema,
} from "validators/auth.validator";

const router = Router();

router
  .route("/register")
  .post(upload.single("avatar"), validate(userRegisterSchema), registerUser);

router
  .route("/login")
  .post(upload.none(), validate(userLoginSchema), loginUser);
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

router.route("/delete-user").delete(verifyJWT, deleteUserAccount);
export default router;
