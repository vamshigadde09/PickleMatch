import express from "express";
import {
    createGame,
    getGameById,
    submitMatchResult,
    calculateWinners,
    assignPoints,
    getUserRecentGames,
    getActiveGameForRoom,
} from "../controllers/gameController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// All game routes require authentication
router.post("/create", authMiddleware, createGame);
router.get("/user/recent", authMiddleware, getUserRecentGames);
router.get("/room/:roomId/active", authMiddleware, getActiveGameForRoom);
router.get("/:gameId", authMiddleware, getGameById);
router.put("/match/:matchId/result", authMiddleware, submitMatchResult);
router.post("/:gameId/calculate-winners", authMiddleware, calculateWinners);
router.post("/:gameId/assign-points", authMiddleware, assignPoints);

export default router;

