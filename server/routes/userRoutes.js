import express from "express";
import { registerUser, loginUser, getAllUsers, getCurrentUser, updateUser, deleteUser, getFriends, addFriend, removeFriend, getUserPartnerStats, searchUsers, getUserProfile } from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/allusers", authMiddleware, getAllUsers);
router.get("/currentuser", authMiddleware, getCurrentUser);
router.get("/partner-stats", authMiddleware, getUserPartnerStats);
router.get("/friends", authMiddleware, getFriends);
router.post("/friends/add", authMiddleware, addFriend);
router.delete("/friends/:friendId", authMiddleware, removeFriend);
router.put("/updateuser", authMiddleware, updateUser);
router.delete("/deleteuser", authMiddleware, deleteUser);
router.get("/search", authMiddleware, searchUsers);
router.get("/profile/:userId", authMiddleware, getUserProfile);

export default router;
