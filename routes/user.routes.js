import {
  userRegister,
  userLogin,
  userLogout,
  refreshAccessToken,
  changeCurrentPassword,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.controller.js";
import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.post(
  "/register",
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  userRegister
);
router.post("/login", userLogin);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", verifyJWT, userLogout);
router.post("/change-password", verifyJWT, changeCurrentPassword);
router.post("/update-account-details", verifyJWT, updateAccountDetails);
router.post(
  "/update-user-avatar",
  verifyJWT,
  upload.single("avatar"),
  updateUserAvatar
);
router.post(
  "/update-user-coverimage",
  verifyJWT,
  upload.single("coverImage"),
  updateUserCoverImage
);
export default router;
