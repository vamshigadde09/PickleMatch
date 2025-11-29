import express from "express";
import { getTopIndividualPlayers, getSeasonalLeaderboard } from "../controllers/topScoresController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/individual", authMiddleware, getTopIndividualPlayers);
router.get("/seasonal", authMiddleware, getSeasonalLeaderboard);

export default router;

