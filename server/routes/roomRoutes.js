import express from "express";
import {
    createRoom,
    getRoomById,
    getRoomByCode,
    getUserRooms,
    updateRoom,
    joinRoom,
    toggleRoomStatus,
    deleteRoom,
    getRoomLeaderboard,
} from "../controllers/roomController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// All room routes require authentication
router.post("/create", authMiddleware, createRoom);
router.post("/join", authMiddleware, joinRoom);
router.get("/user/rooms", authMiddleware, getUserRooms);
router.get("/code/:code", authMiddleware, getRoomByCode);
// IMPORTANT: More specific routes must come before generic :roomId route
router.get("/:roomId/leaderboard", authMiddleware, getRoomLeaderboard);
router.get("/:roomId", authMiddleware, getRoomById);
router.put("/:roomId", authMiddleware, updateRoom);
router.patch("/:roomId/toggle-status", authMiddleware, toggleRoomStatus);
router.delete("/:roomId", authMiddleware, deleteRoom);

export default router;

