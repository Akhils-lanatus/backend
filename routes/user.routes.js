import {
  userRegister,
  userLogin,
  userLogout,
  refreshAccessToken,
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
router.route("/logout").post(verifyJWT, userLogout);
router.route("/refresh-token").post(refreshAccessToken);
export default router;
