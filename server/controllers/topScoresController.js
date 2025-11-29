/**
 * Top Scores Controller
 * Handles global leaderboards and top scores
 */

import User from "../models/userModel.js";
import Game from "../models/gameModel.js";

// GET - Get top individual players
// Query params: sortBy (points|wins|streak), limit (default: 50)
const getTopIndividualPlayers = async (req, res) => {
    try {
        const { sortBy = 'points', limit = 50 } = req.query;
        const limitNum = parseInt(limit, 10);

        const users = await User.find({})
            .select('username displayName avatarUrl individualPoints stats teamPoints')
            .lean();

        // Sort users based on sortBy parameter
        users.sort((a, b) => {
            if (sortBy === 'wins') {
                const winsA = a.stats?.totalWins || 0;
                const winsB = b.stats?.totalWins || 0;
                return winsB - winsA;
            } else if (sortBy === 'streak') {
                const streakA = a.stats?.streak || 0;
                const streakB = b.stats?.streak || 0;
                return streakB - streakA;
            } else {
                // Default: sort by points
                const pointsA = a.individualPoints || 0;
                const pointsB = b.individualPoints || 0;
                return pointsB - pointsA;
            }
        });

        // Apply limit after sorting
        const limitedUsers = users.slice(0, limitNum);

        // Calculate win percentage for each user
        const playersWithStats = limitedUsers.map((user) => {
            const winPercentage = user.stats?.totalGames > 0
                ? ((user.stats.totalWins / user.stats.totalGames) * 100).toFixed(1)
                : 0;

            return {
                _id: user._id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                points: user.individualPoints || 0,
                teamPoints: user.teamPoints || 0,
                wins: user.stats?.totalWins || 0,
                games: user.stats?.totalGames || 0,
                streak: user.stats?.streak || 0,
                winPercentage: parseFloat(winPercentage),
            };
        });

        res.status(200).json({
            success: true,
            players: playersWithStats,
            sortBy,
        });
    } catch (error) {
        console.error("Error getting top individual players:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// GET - Get seasonal leaderboard
// Query params: period (weekly|monthly), metric (points|wins|streak|games), limit (default: 50)
const getSeasonalLeaderboard = async (req, res) => {
    try {
        const { period = 'monthly', metric = 'points', limit = 50 } = req.query;
        const limitNum = parseInt(limit, 10);

        // Calculate date range based on period
        const now = new Date();
        let startDate;

        if (period === 'weekly') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
        } else if (period === 'monthly') {
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 1);
        } else {
            // Default to all-time (no date filter)
            startDate = null;
        }

        // Get users with their game participation in the period
        const users = await User.find({})
            .select('username displayName avatarUrl individualPoints stats teamPoints createdAt')
            .lean();

        // Filter games by date if period is specified
        let gamesQuery = { status: 'completed' };
        if (startDate) {
            gamesQuery.createdAt = { $gte: startDate };
        }

        const gamesInPeriod = await Game.find(gamesQuery)
            .select('teams medals createdAt')
            .lean();

        // Calculate metrics for each user in the period
        const userMetrics = new Map();

        users.forEach((user) => {
            userMetrics.set(user._id.toString(), {
                userId: user._id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                points: 0,
                wins: 0,
                games: 0,
                streak: user.stats?.streak || 0, // Current streak
            });
        });

        // Process games to calculate period-specific metrics
        gamesInPeriod.forEach((game) => {
            // Count games played
            if (game.teams && Array.isArray(game.teams)) {
                game.teams.forEach((team) => {
                    if (team.players && Array.isArray(team.players)) {
                        team.players.forEach((player) => {
                            if (player.userId) {
                                const userIdStr = player.userId.toString();
                                const metrics = userMetrics.get(userIdStr);
                                if (metrics) {
                                    metrics.games += 1;

                                    // Check if this team won (got a medal)
                                    if (team.medal && team.medal !== null) {
                                        metrics.wins += 1;
                                    }
                                }
                            }
                        });
                    }
                });
            }

            // Calculate points from medals (if medals exist)
            if (game.medals) {
                ['gold', 'silver', 'bronze'].forEach((medalType) => {
                    if (game.medals[medalType] && game.medals[medalType].players) {
                        game.medals[medalType].players.forEach((playerId) => {
                            const userIdStr = playerId.toString();
                            const metrics = userMetrics.get(userIdStr);
                            if (metrics) {
                                // Medal points: Gold = 10, Silver = 7, Bronze = 5, Participation = 2
                                if (medalType === 'gold') {
                                    metrics.points += 10;
                                } else if (medalType === 'silver') {
                                    metrics.points += 7;
                                } else if (medalType === 'bronze') {
                                    metrics.points += 5;
                                }
                            }
                        });
                    }
                });
            }
        });

        // Convert to array and sort by metric
        let sortField = 'points';
        if (metric === 'wins') {
            sortField = 'wins';
        } else if (metric === 'streak') {
            sortField = 'streak';
        } else if (metric === 'games') {
            sortField = 'games';
        }

        const leaderboard = Array.from(userMetrics.values())
            .filter((user) => {
                // Filter out users with 0 in the selected metric
                if (sortField === 'points') return user.points > 0;
                if (sortField === 'wins') return user.wins > 0;
                if (sortField === 'games') return user.games > 0;
                return user.streak > 0;
            })
            .sort((a, b) => {
                if (sortField === 'points') return b.points - a.points;
                if (sortField === 'wins') return b.wins - a.wins;
                if (sortField === 'games') return b.games - a.games;
                return b.streak - a.streak;
            })
            .slice(0, limitNum)
            .map((user, index) => ({
                ...user,
                rank: index + 1,
                winPercentage: user.games > 0 ? ((user.wins / user.games) * 100).toFixed(1) : 0,
            }));

        res.status(200).json({
            success: true,
            leaderboard,
            period,
            metric,
        });
    } catch (error) {
        console.error("Error getting seasonal leaderboard:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

export {
    getTopIndividualPlayers,
    getSeasonalLeaderboard,
};

