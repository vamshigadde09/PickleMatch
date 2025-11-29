import User from "../models/userModel.js";
import Game from "../models/gameModel.js";
import Match from "../models/matchModel.js";
import Room from "../models/roomModel.js";
import UnregisteredPlayer from "../models/unregisteredPlayerModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { transferUnregisteredPlayerToUser, generateSystemName } from "../utils/unregisteredPlayerUtils.js";

// Ensure we have a JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-123';

const normalizeMobile = (mobile) => {
    // Remove spaces, dashes, parentheses, and plus signs
    const cleanMobile = mobile.replace(/[\s\-+()]/g, '');

    // Remove +91 country code if present
    const normalizedMobile = cleanMobile.replace(/^91/, '');

    // Keep only last 10 digits for Indian mobile numbers
    return normalizedMobile.slice(-10);
};

// Helper: Link userId to existing records (Games, Matches, Rooms) using UnregisteredPlayer data
// IMPORTANT: Linking is done by MOBILE NUMBER ONLY, not by name
// Replaces all names with system-generated name (e.g., "user1234") for privacy
const linkUnregisteredUserData = async (userId, normalizedMobile, unregisteredPlayerData, systemName) => {
    try {
        console.log(`🔗 Linking unregistered user data for userId: ${userId}, mobile: ${normalizedMobile}`);
        console.log(`🔒 Using system name for privacy: ${systemName}`);

        const { gameIds = [], matchIds = [], roomIds = [] } = unregisteredPlayerData;
        let gamesUpdated = 0;
        let matchesUpdated = 0;
        let roomsUpdated = 0;

        // 1. Link to Rooms and replace name with system name
        for (const roomId of roomIds) {
            const room = await Room.findById(roomId);
            if (room) {
                for (const player of room.players) {
                    if (player.mobile === normalizedMobile && !player.userId) {
                        player.userId = userId;
                        player.name = systemName; // Replace name with system-generated name for privacy
                        await room.save();
                        roomsUpdated++;
                        break; // One room can only have one instance of this mobile
                    }
                }
            }
        }

        // 2. Link to Games and replace name with system name
        for (const gameId of gameIds) {
            const game = await Game.findById(gameId);
            if (game) {
                let gameUpdated = false;
                for (const team of game.teams) {
                    for (const player of team.players) {
                        if (player.mobile === normalizedMobile && !player.userId) {
                            player.userId = userId;
                            player.name = systemName; // Replace name with system-generated name for privacy
                            gameUpdated = true;
                        }
                    }
                }
                if (gameUpdated) {
                    await game.save();
                    gamesUpdated++;
                }
            }
        }

        // 3. Link to Matches and replace name with system name
        for (const matchId of matchIds) {
            const match = await Match.findById(matchId);
            if (match) {
                let matchUpdated = false;

                // Update teamA players
                if (match.teamA && match.teamA.players) {
                    for (const player of match.teamA.players) {
                        if (player.mobile === normalizedMobile && !player.userId) {
                            player.userId = userId;
                            player.name = systemName; // Replace name with system-generated name for privacy
                            matchUpdated = true;
                        }
                    }
                }

                // Update teamB players
                if (match.teamB && match.teamB.players) {
                    for (const player of match.teamB.players) {
                        if (player.mobile === normalizedMobile && !player.userId) {
                            player.userId = userId;
                            player.name = systemName; // Replace name with system-generated name for privacy
                            matchUpdated = true;
                        }
                    }
                }

                if (matchUpdated) {
                    await match.save();
                    matchesUpdated++;
                }
            }
        }

        console.log(`✅ Updated ${roomsUpdated} rooms, ${gamesUpdated} games, ${matchesUpdated} matches with system name: ${systemName}`);
        return { gamesUpdated, matchesUpdated, roomsUpdated, systemName };
    } catch (error) {
        console.error('Error linking unregistered user data:', error);
        throw error;
    }
};

const registerUser = async (req, res) => {
    try {
        const { username, displayName, mobile, password } = req.body;

        // Validate required fields
        if (!username || !displayName || !mobile || !password) {
            return res.status(400).json({
                success: false,
                message: "Username, display name, mobile, and password are required",
            });
        }

        // Normalize mobile number
        const normalizedMobile = normalizeMobile(mobile);

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ username: username.toLowerCase() }, { mobile: normalizedMobile }],
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User already exists",
                conflict:
                    existingUser.username === username.toLowerCase() ? "username" : "mobile",
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create new user
        const newUser = new User({
            username: username.toLowerCase(),
            displayName,
            mobile: normalizedMobile,
            passwordHash,
            avatarUrl: req.body.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`
        });

        await newUser.save();

        // Check for and transfer unregistered player data
        try {
            // Generate unique system name for privacy (e.g., "user1234")
            // This will replace all personal names/nicknames with anonymous identifier
            const systemName = await generateSystemName();
            console.log(`🔒 Generated unique system name for privacy: ${systemName}`);

            // Transfer data from UnregisteredPlayer model
            const transferResult = await transferUnregisteredPlayerToUser(newUser._id, normalizedMobile, systemName);
            console.log('🔗 Transfer result:', transferResult);

            if (transferResult.found) {
                // Transfer points and stats to user
                const user = await User.findById(newUser._id);

                // Add pending points
                if (transferResult.individualPoints > 0) {
                    user.individualPoints = (user.individualPoints || 0) + transferResult.individualPoints;
                }
                if (transferResult.teamPoints > 0) {
                    user.teamPoints = (user.teamPoints || 0) + transferResult.teamPoints;
                }

                // Merge stats
                if (transferResult.stats) {
                    if (!user.stats) {
                        user.stats = {};
                    }
                    user.stats.totalGames = (user.stats.totalGames || 0) + (transferResult.stats.totalGames || 0);
                    user.stats.totalWins = (user.stats.totalWins || 0) + (transferResult.stats.totalWins || 0);
                    if (transferResult.stats.streak) {
                        user.stats.streak = Math.max(user.stats.streak || 0, transferResult.stats.streak || 0);
                    }
                }

                await user.save();

                // Now link userId to all Games, Matches, and Rooms
                // This will also replace all names with the system-generated name for privacy
                const linkResults = await linkUnregisteredUserData(newUser._id, normalizedMobile, {
                    gameIds: transferResult.gameIds || [],
                    matchIds: transferResult.matchIds || [],
                    roomIds: transferResult.roomIds || []
                }, systemName);

                // Refresh user data
                const updatedUser = await User.findById(newUser._id);
                const userResponse = updatedUser.toObject();
                delete userResponse.__v;
                delete userResponse.passwordHash;

                res.status(201).json({
                    success: true,
                    message: "User registered successfully. Previous match history and points have been linked.",
                    user: userResponse,
                    linkedData: {
                        rooms: linkResults.roomsUpdated,
                        games: linkResults.gamesUpdated,
                        matches: linkResults.matchesUpdated,
                        pointsAwarded: transferResult.individualPoints,
                        teamPointsAwarded: transferResult.teamPoints
                    }
                });
            } else {
                // No unregistered player data found - normal registration
                const userResponse = newUser.toObject();
                delete userResponse.__v;
                delete userResponse.passwordHash;

                res.status(201).json({
                    success: true,
                    message: "User registered successfully",
                    user: userResponse,
                });
            }
        } catch (linkError) {
            console.error('Error linking user data (non-critical):', linkError);
            // Still return success - user is registered, linking can happen later
            const userResponse = newUser.toObject();
            delete userResponse.__v;
            delete userResponse.passwordHash;

            res.status(201).json({
                success: true,
                message: "User registered successfully",
                user: userResponse,
                warning: "Could not link previous match history automatically. Please contact support if needed."
            });
        }
    } catch (err) {
        console.error("Registration error:", err);

        // Handle Mongoose validation errors
        if (err.name === "ValidationError") {
            const errors = Object.values(err.errors).map((el) => el.message);
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }

        // Handle duplicate key error
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(409).json({
                success: false,
                message: `${field} already exists`,
            });
        }

        res.status(500).json({
            success: false,
            message: "Server error during registration",
            error: err.message,
        });
    }
};

const loginUser = async (req, res) => {
    const { username, mobile, password } = req.body;

    // Debug logging
    console.log('Login request received:', { username, mobile, password: password ? '***' : 'missing' });

    // Validate input exists
    if ((!username && !mobile) || !password) {
        console.log('Validation failed: Missing required fields');
        return res.status(400).json({
            success: false,
            message: "Username or mobile and password are required",
        });
    }

    // If mobile is provided, validate Indian mobile format
    if (mobile) {
        console.log('Validating mobile number:', mobile);

        // Remove any spaces, dashes, or country codes
        const cleanMobile = mobile.replace(/[\s\-+()]/g, '');

        // Indian mobile number validation
        // Supports: 10 digits starting with 6-9, or with +91 country code
        const indianMobileRegex = /^(\+91)?[6-9]\d{9}$/;

        if (!indianMobileRegex.test(cleanMobile)) {
            console.log('Indian mobile validation failed for:', mobile);
            return res.status(400).json({
                success: false,
                message: "Please enter a valid Indian mobile number (10 digits starting with 6-9)",
            });
        }

        // Normalize to 10 digits (remove +91 if present)
        const normalizedMobile = cleanMobile.replace(/^\+91/, '');
        console.log('Normalized mobile number:', normalizedMobile);
    }

    try {
        // Find user by username or mobile
        let user;
        if (mobile) {
            // Use normalized mobile number for lookup
            const cleanMobile = mobile.replace(/[\s\-+()]/g, '');
            const normalizedMobile = cleanMobile.replace(/^\+91/, '');
            user = await User.findOne({ mobile: normalizedMobile });
            console.log('Looking up user with mobile:', normalizedMobile);
        } else if (username) {
            user = await User.findOne({ username: username.toLowerCase() });
            console.log('Looking up user with username:', username.toLowerCase());
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found. Please register first.",
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid password",
            });
        }

        // Generate JWT token with longer expiration (30 days)
        const tokenPayload = {
            userId: user._id,
            username: user.username,
            mobile: user.mobile,
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, {
            expiresIn: '30d' // 30 days expiration
        });

        // Prepare user data for response (excluding sensitive data)
        const userData = {
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
            mobile: user.mobile,
            showMobile: user.showMobile,
            friends: user.friends,
            individualPoints: user.individualPoints,
            teamPoints: user.teamPoints,
            stats: user.stats,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        res.status(200).json({
            success: true,
            message: "Login successful",
            user: userData,
            token: token
        });
        console.log('Login successful for user:', userData.username || userData.mobile);
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message
        });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select("-__v -passwordHash");
        res.status(200).json({
            success: true,
            count: users.length,
            users,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        // Fetch fresh user data from database to get latest individualPoints
        const userId = req.user._id;
        const user = await User.findById(userId).select("-passwordHash -__v");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Remove sensitive data from response
        const userResponse = user.toObject ? user.toObject() : user;
        delete userResponse.passwordHash;
        delete userResponse.__v;

        res.status(200).json({
            success: true,
            user: userResponse,
        });
    } catch (error) {
        console.error("Error in getCurrentUser:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: process.env.NODE_ENV === "development" ? error.message : undefined
        });
    }
};

const updateUser = async (req, res) => {
    const { username, displayName, mobile, showMobile, avatarUrl, password } = req.body;
    const userId = req.user._id;

    try {
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check for existing username or mobile conflicts
        if (username) {
            const usernameExists = await User.findOne({
                username: username.toLowerCase(),
                _id: { $ne: userId },
            });

            if (usernameExists) {
                return res.status(409).json({
                    success: false,
                    message: "Username is already in use by another user",
                });
            }
        }

        if (mobile) {
            const normalizedMobile = normalizeMobile(mobile);
            const mobileExists = await User.findOne({
                mobile: normalizedMobile,
                _id: { $ne: userId },
            });

            if (mobileExists) {
                return res.status(409).json({
                    success: false,
                    message: "Mobile number is already in use by another user",
                });
            }
        }

        // Update user information
        if (username) user.username = username.toLowerCase();
        if (displayName) user.displayName = displayName;
        if (mobile) user.mobile = normalizeMobile(mobile);
        if (showMobile !== undefined) user.showMobile = showMobile;
        if (avatarUrl) user.avatarUrl = avatarUrl;

        // Update password if provided
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.passwordHash = await bcrypt.hash(password, salt);
        }

        await user.save();

        // Remove sensitive data from response
        const userResponse = user.toObject();
        delete userResponse.passwordHash;
        delete userResponse.__v;

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: userResponse,
        });
    } catch (error) {
        console.error("Error updating user:", error);

        // Handle duplicate key error
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({
                success: false,
                message: `${field} is already in use by another user`,
            });
        }

        res.status(500).json({
            success: false,
            message: "Server error during update",
            error: error.message,
        });
    }
};

const deleteUser = async (req, res) => {
    const userId = req.user._id;

    try {
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Delete user
        await User.findByIdAndDelete(userId);

        res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({
            success: false,
            message: "Server error during deletion",
            error: error.message,
        });
    }
};



const getFriends = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find user and populate friends (include individualPoints and teamPoints)
        const user = await User.findById(userId)
            .populate('friends', 'username displayName mobile avatarUrl individualPoints teamPoints')
            .select('friends');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Transform friends to include id and name fields for frontend compatibility
        const friends = (user.friends || []).map((friend) => ({
            id: friend._id,
            _id: friend._id,
            name: friend.displayName || friend.username,
            displayName: friend.displayName,
            username: friend.username,
            mobile: friend.mobile,
            avatarUrl: friend.avatarUrl,
            individualPoints: friend.individualPoints || 0,
            teamPoints: friend.teamPoints || 0,
        }));

        res.status(200).json({
            success: true,
            friends,
        });
    } catch (error) {
        console.error("Error getting friends:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// Add friend by mobile number or username
const addFriend = async (req, res) => {
    try {
        const userId = req.user._id;
        const { mobile, username } = req.body;

        if (!mobile && !username) {
            return res.status(400).json({
                success: false,
                message: "Either mobile number or username is required",
            });
        }

        // Find the user to add as friend
        let friendToAdd = null;
        if (mobile) {
            const normalizedMobile = normalizeMobile(mobile);
            friendToAdd = await User.findOne({ mobile: normalizedMobile });
        } else if (username) {
            friendToAdd = await User.findOne({ username: username.toLowerCase() });
        }

        if (!friendToAdd) {
            return res.status(404).json({
                success: false,
                message: "User not found. Please check the mobile number or username.",
            });
        }

        // Check if trying to add self
        if (friendToAdd._id.toString() === userId.toString()) {
            return res.status(400).json({
                success: false,
                message: "You cannot add yourself as a friend",
            });
        }

        // Get current user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if already a friend
        if (user.friends.includes(friendToAdd._id)) {
            return res.status(409).json({
                success: false,
                message: "User is already in your friends list",
            });
        }

        // Add friend
        user.friends.push(friendToAdd._id);
        await user.save();

        // Populate and return friend data
        await user.populate('friends', 'username displayName mobile avatarUrl individualPoints teamPoints');
        const addedFriend = user.friends[user.friends.length - 1];

        res.status(200).json({
            success: true,
            message: "Friend added successfully",
            friend: {
                id: addedFriend._id,
                _id: addedFriend._id,
                name: addedFriend.displayName || addedFriend.username,
                displayName: addedFriend.displayName,
                username: addedFriend.username,
                mobile: addedFriend.mobile,
                avatarUrl: addedFriend.avatarUrl,
                individualPoints: addedFriend.individualPoints || 0,
                teamPoints: addedFriend.teamPoints || 0,
            },
        });
    } catch (error) {
        console.error("Error adding friend:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// Remove friend
const removeFriend = async (req, res) => {
    try {
        const userId = req.user._id;
        const { friendId } = req.params;

        if (!friendId) {
            return res.status(400).json({
                success: false,
                message: "Friend ID is required",
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Remove friend from friends array
        user.friends = user.friends.filter(
            (friend) => friend.toString() !== friendId.toString()
        );
        await user.save();

        res.status(200).json({
            success: true,
            message: "Friend removed successfully",
        });
    } catch (error) {
        console.error("Error removing friend:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// Get user partner stats (best partner and most frequent teammate)
const getUserPartnerStats = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find all completed games where user participated
        let games = await Game.find({
            'teams.players.userId': userId,
            status: 'completed'
        })
            .select('teams medals createdAt')
            .sort({ createdAt: -1 })
            .limit(100); // Analyze last 100 games

        // Collect all userIds that need to be populated
        const userIdsToPopulate = new Set();
        for (const game of games) {
            for (const team of game.teams) {
                for (const player of team.players) {
                    if (player.userId) {
                        userIdsToPopulate.add(player.userId.toString());
                    }
                }
            }
        }

        // Fetch all users at once
        const usersMap = new Map();
        if (userIdsToPopulate.size > 0) {
            const users = await User.find({
                _id: { $in: Array.from(userIdsToPopulate) }
            }).select('displayName username avatarUrl');

            users.forEach(user => {
                usersMap.set(user._id.toString(), {
                    displayName: user.displayName,
                    username: user.username,
                    avatarUrl: user.avatarUrl
                });
            });
        }

        // Replace userId ObjectIds with populated user data
        games = games.map(game => {
            const updatedTeams = game.teams.map(team => ({
                ...team.toObject(),
                players: team.players.map(player => ({
                    ...player.toObject(),
                    userId: player.userId ? {
                        _id: player.userId,
                        ...(usersMap.get(player.userId.toString()) || {})
                    } : null
                }))
            }));
            return {
                ...game.toObject(),
                teams: updatedTeams
            };
        });

        // Track partners
        const partnerStats = new Map(); // partnerId -> { name, games, winsTogether }

        for (const game of games) {
            // Find user's team in this game
            let userTeam = null;
            for (const team of game.teams) {
                const isInTeam = team.players.some(p =>
                    p.userId && p.userId.toString() === userId.toString()
                );
                if (isInTeam) {
                    userTeam = team;
                    break;
                }
            }

            if (!userTeam) continue;

            // Get all partners (teammates) in this game
            const teammates = userTeam.players
                .filter(p => p.userId && p.userId.toString() !== userId.toString())
                .map(p => {
                    const userIdObj = p.userId._id || p.userId;
                    return {
                        id: userIdObj.toString(),
                        userIdObj: userIdObj,
                        name: (p.userId && p.userId.displayName) || (p.userId && p.userId.username) || p.name,
                        avatarUrl: (p.userId && p.userId.avatarUrl) || null
                    };
                });

            // Check if user's team won (got gold medal)
            const wonGame = game.medals?.gold?.team === userTeam.letter;

            // Track each teammate
            for (const teammate of teammates) {
                const partnerId = teammate.id;
                const existing = partnerStats.get(partnerId);

                if (existing) {
                    existing.games += 1;
                    if (wonGame) {
                        existing.winsTogether += 1;
                    }
                } else {
                    partnerStats.set(partnerId, {
                        id: teammate.userIdObj,
                        name: teammate.name,
                        avatarUrl: teammate.avatarUrl,
                        games: 1,
                        winsTogether: wonGame ? 1 : 0,
                    });
                }
            }
        }

        // Find best partner (highest win rate, minimum 3 games together)
        let bestPartner = null;
        let bestWinRate = 0;
        const minGamesForBestPartner = 3;

        for (const [partnerId, stats] of partnerStats.entries()) {
            if (stats.games >= minGamesForBestPartner) {
                const winRate = (stats.winsTogether / stats.games) * 100;
                if (winRate > bestWinRate || (winRate === bestWinRate && stats.games > (bestPartner?.games || 0))) {
                    bestWinRate = winRate;
                    bestPartner = {
                        ...stats,
                        winRate: winRate.toFixed(1),
                    };
                }
            }
        }

        // Find most frequent teammate (most games together)
        let mostFrequent = null;
        let maxGames = 0;

        for (const [partnerId, stats] of partnerStats.entries()) {
            if (stats.games > maxGames) {
                maxGames = stats.games;
                mostFrequent = {
                    ...stats,
                };
            }
        }

        res.status(200).json({
            success: true,
            bestPartner: bestPartner || null,
            mostFrequentTeammate: mostFrequent || null,
            totalPartners: partnerStats.size,
        });
    } catch (error) {
        console.error("Error getting user partner stats:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// SEARCH - Search users by name, username, or phone number
// Query params: q (search query), requires at least 7 characters for phone number
const searchUsers = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Search query is required",
            });
        }

        const searchQuery = q.trim();

        // Check if query looks like a phone number (all digits)
        const cleanPhone = searchQuery.replace(/[\s\-+()]/g, '');
        const isPhoneNumber = /^\d+$/.test(cleanPhone);

        if (isPhoneNumber) {
            // Phone number search - require at least 7 digits for privacy
            if (cleanPhone.length < 7) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter at least 7 digits to search by phone number",
                });
            }

            // Normalize phone number
            const normalizedPhone = normalizeMobile(cleanPhone);

            // Search by matching last 7+ digits (at least 7, up to 10)
            const searchDigits = normalizedPhone.slice(-Math.min(cleanPhone.length, 10));
            const phoneRegex = new RegExp(searchDigits + '$');

            const users = await User.find({
                mobile: { $regex: phoneRegex }
            })
                .select('username displayName avatarUrl mobile')
                .limit(50)
                .lean();

            // Get current user to check friend status
            const currentUser = await User.findById(req.user._id)
                .select('friends')
                .lean();

            const results = users.map((user) => {
                const isFriend = currentUser?.friends?.some(
                    (friendId) => friendId.toString() === user._id.toString()
                );
                const isSelf = req.user._id.toString() === user._id.toString();

                return {
                    _id: user._id,
                    username: user.username,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                    isFriend: isFriend || false,
                    isSelf: isSelf,
                    // Mask phone number - only show last 4 digits
                    mobile: user.mobile ? `******${user.mobile.slice(-4)}` : null,
                };
            });

            return res.status(200).json({
                success: true,
                users: results,
                query: searchQuery,
            });
        } else {
            // Name or username search
            const nameRegex = new RegExp(searchQuery, 'i'); // Case-insensitive

            const users = await User.find({
                $or: [
                    { displayName: { $regex: nameRegex } },
                    { username: { $regex: nameRegex } },
                ]
            })
                .select('username displayName avatarUrl')
                .limit(50)
                .lean();

            // Get current user to check friend status
            const currentUser = await User.findById(req.user._id)
                .select('friends')
                .lean();

            const results = users.map((user) => {
                const isFriend = currentUser?.friends?.some(
                    (friendId) => friendId.toString() === user._id.toString()
                );
                const isSelf = req.user._id.toString() === user._id.toString();

                return {
                    _id: user._id,
                    username: user.username,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                    isFriend: isFriend || false,
                    isSelf: isSelf,
                };
            });

            return res.status(200).json({
                success: true,
                users: results,
                query: searchQuery,
            });
        }
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// GET - Get user profile by ID
const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
            });
        }

        // Get the user profile
        const user = await User.findById(userId)
            .select('username displayName mobile avatarUrl individualPoints teamPoints stats showMobile')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Get current user to check if they are friends
        const currentUser = await User.findById(currentUserId)
            .select('friends')
            .lean();

        const isFriend = currentUser?.friends?.some(
            (friendId) => friendId.toString() === userId.toString()
        );
        const isSelf = currentUserId.toString() === userId.toString();

        // Calculate win percentage
        const winPercentage = user.stats?.totalGames > 0
            ? ((user.stats.totalWins / user.stats.totalGames) * 100).toFixed(1)
            : 0;

        // Prepare response
        const profileData = {
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
            isFriend: isFriend || false,
            isSelf: isSelf,
        };

        // Only show mobile number if:
        // 1. It's the current user's own profile, OR
        // 2. The user has showMobile enabled
        if (isSelf || user.showMobile) {
            profileData.mobile = user.mobile;
        } else {
            profileData.mobile = null;
        }

        res.status(200).json({
            success: true,
            profile: profileData,
        });
    } catch (error) {
        console.error("Error getting user profile:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

export {
    registerUser,
    loginUser,
    getAllUsers,
    getCurrentUser,
    updateUser,
    deleteUser,
    getFriends,
    addFriend,
    removeFriend,
    getUserPartnerStats,
    searchUsers,
    getUserProfile,
};
