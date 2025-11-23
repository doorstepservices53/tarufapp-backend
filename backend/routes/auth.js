import express from "express";
import {
  Login,
  MemberLogin,
  verifyLogin,
  verifyMemberLogin,
} from "../controller/authController.js";

const router = express.Router();

router.post("/login", Login);
router.post("/member-login", MemberLogin);
router.post("/verifyLogin", verifyLogin);
router.get("/verifyLogin", verifyLogin);
router.post("/verifyMemberLogin", verifyMemberLogin);

export default router;
