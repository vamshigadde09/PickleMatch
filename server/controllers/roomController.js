import Room from "../models/roomModel.js";
import User from "../models/userModel.js";
import Game from "../models/gameModel.js";
import {
    getOrCreateUnregisteredPlayer,
    trackUnregisteredPlayerParticipation
} from "../utils/unregisteredPlayerUtils.js";

// Generate a unique 6-character room code
const generateRoomCode = async () => {
    let code;
    let isUnique = false;

    while (!isUnique) {
        // Generate random 6-character uppercase code
        code = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Check if code already exists
        const existingRoom = await Room.findOne({ code });
        if (!existingRoom) {
            isUnique = true;
        }
    }

    return code;
};

// Normalize mobile number
const normalizeMobile = (mobile) => {
    const cleanMobile = mobile.replace(/[\s\-+()]/g, '');
    const normalizedMobile = cleanMobile.replace(/^91/, '');
    return normalizedMobile.slice(-10);
};

// CREATE - Create a new room
const createRoom = async (req, res) => {
    try {
        const { name, players, showMobileNumber } = req.body;
        const userId = req.user._id;

        // Validate required fields
        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Room name is required",
            });
        }

        if (name.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: "Room name must be at least 3 characters",
            });
        }

        // Validate players array (can be empty - creator will be automatically added)
        if (!players || !Array.isArray(players)) {
            return res.status(400).json({
                success: false,
                message: "Players must be an array (can be empty - others can join via room code later)",
            });
        }

        // Check if user already has an active room (only creators are restricted)
        const existingActiveRoom = await Room.findOne({
            createdBy: userId,
            status: "active"
        });

        if (existingActiveRoom) {
            return res.status(400).json({
                success: false,
                message: "You already have an active room. Please deactivate it before creating a new one.",
            });
        }

        // Generate unique room code
        const roomCode = await generateRoomCode();

        // Process players: check if they are existing users or new players
        const processedPlayers = [];
        const memberIds = [userId]; // Creator is automatically a member

        // Get creator's user info to add them as a player
        const creator = await User.findById(userId);
        if (!creator) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Track creator's mobile to avoid duplicates
        const creatorMobile = normalizeMobile(creator.mobile || '');

        // Add creator as first player (room creator is always a player)
        processedPlayers.push({
            userId: creator._id,
            name: creator.displayName || creator.username || 'Room Creator',
            mobile: creator.mobile || '',
        });

        // Process players from frontend (skip creator if they accidentally added themselves)
        for (const player of players) {
            const normalizedMobile = normalizeMobile(player.mobile);

            // Skip if this is the creator (already added above)
            if (creatorMobile && normalizedMobile === creatorMobile) {
                continue;
            }

            // Check if player is an existing user
            let existingUser = null;
            if (player.id && !player.id.toString().startsWith('new-')) {
                existingUser = await User.findById(player.id);
                // Also skip if this user ID is the creator
                if (existingUser && existingUser._id.toString() === userId.toString()) {
                    continue;
                }
            }

            // If not found by ID, try to find by mobile
            if (!existingUser) {
                existingUser = await User.findOne({ mobile: normalizedMobile });
                // Skip if found user is the creator
                if (existingUser && existingUser._id.toString() === userId.toString()) {
                    continue;
                }
            }

            if (existingUser) {
                // Existing user - link them
                processedPlayers.push({
                    userId: existingUser._id,
                    name: existingUser.displayName || player.name,
                    mobile: existingUser.mobile,
                });

                // Add to members if not already added
                if (!memberIds.includes(existingUser._id.toString())) {
                    memberIds.push(existingUser._id);
                }
            } else {
                // New player - just store name and mobile
                processedPlayers.push({
                    userId: null,
                    name: player.name.trim(),
                    mobile: normalizedMobile,
                });
            }
        }

        // Create new room
        const newRoom = new Room({
            name: name.trim(),
            code: roomCode,
            createdBy: userId,
            members: memberIds,
            players: processedPlayers,
            showMobileNumber: showMobileNumber || false,
            status: "active",
        });

        await newRoom.save();

        // Track unregistered players in this room
        for (const player of processedPlayers) {
            if (!player.userId && player.mobile) {
                await getOrCreateUnregisteredPlayer(player.mobile, player.name);
                await trackUnregisteredPlayerParticipation(player.mobile, {
                    roomId: newRoom._id
                });
            }
        }

        // Populate the room with user details
        const populatedRoom = await Room.findById(newRoom._id)
            .populate('createdBy', 'username displayName mobile avatarUrl individualPoints')
            .populate('members', 'username displayName mobile avatarUrl individualPoints')
            .select('-__v');

        res.status(201).json({
            success: true,
            message: "Room created successfully",
            room: populatedRoom,
        });
    } catch (err) {
        console.error("Create room error:", err);

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
            message: "Server error during room creation",
            error: err.message,
        });
    }
};

// READ - Get room by ID
const getRoomById = async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await Room.findById(roomId)
            .populate('createdBy', 'username displayName mobile avatarUrl individualPoints')
            .populate('members', 'username displayName mobile avatarUrl individualPoints')
            .populate('history', 'type status createdAt')
            .select('-__v');

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        res.status(200).json({
            success: true,
            room,
        });
    } catch (error) {
        console.error("Error getting room:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// READ - Get room by code
const getRoomByCode = async (req, res) => {
    try {
        const { code } = req.params;

        const room = await Room.findOne({ code: code.toUpperCase() })
            .populate('createdBy', 'username displayName mobile avatarUrl individualPoints')
            .populate('members', 'username displayName mobile avatarUrl individualPoints')
            .select('-__v');

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        res.status(200).json({
            success: true,
            room,
        });
    } catch (error) {
        console.error("Error getting room by code:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// READ - Get all rooms for current user
const getUserRooms = async (req, res) => {
    try {
        const userId = req.user._id;
        const includeInactive = req.query.includeInactive === 'true' || req.query.all === 'true';

        console.log('[getUserRooms] Request params:', {
            includeInactive: req.query.includeInactive,
            all: req.query.all,
            parsedIncludeInactive: includeInactive,
            userId: userId.toString()
        });

        // Build query - check if user is creator, member, OR player
        // Query for rooms where user is creator
        const creatorQuery = { createdBy: userId };
        // Query for rooms where user is in members array
        const memberQuery = { members: userId };  // MongoDB handles array membership automatically
        // Query for rooms where user is in players array (as a registered player with userId)
        const playerQuery = { 'players.userId': userId };

        // Combine queries - user should see rooms where they are creator, member, OR player
        const baseQuery = {
            $or: [
                creatorQuery,
                memberQuery,
                playerQuery
            ]
        };

        // Add status filter if not including inactive rooms
        const finalQuery = includeInactive ? baseQuery : { ...baseQuery, status: "active" };

        console.log('[getUserRooms] Final Query:', JSON.stringify(finalQuery, null, 2));
        console.log('[getUserRooms] UserId:', userId.toString(), 'Type:', userId.constructor.name);
        console.log('[getUserRooms] IncludeInactive:', includeInactive);

        // Debug: Check all rooms for this user (without status filter)
        const allRoomsDebug = await Room.find({
            $or: [
                { createdBy: userId },
                { members: userId },
                { 'players.userId': userId }
            ]
        }).select('name status createdBy members players').lean();

        console.log('[getUserRooms] Debug - All rooms for user (no status filter):', {
            count: allRoomsDebug.length,
            rooms: allRoomsDebug.map(r => ({
                name: r.name,
                status: r.status,
                createdBy: r.createdBy?.toString(),
                members: r.members?.map(m => m.toString()) || [],
                players: r.players?.filter(p => p.userId).map(p => p.userId.toString()) || []
            }))
        });

        // Execute query
        const rooms = await Room.find(finalQuery)
            .populate('createdBy', 'username displayName mobile avatarUrl individualPoints')
            .populate('members', 'username displayName mobile avatarUrl individualPoints')
            .select('-__v')
            .sort({ updatedAt: -1 });

        console.log('[getUserRooms] Found rooms:', {
            count: rooms.length,
            statuses: rooms.map(r => ({
                name: r.name,
                status: r.status,
                createdBy: r.createdBy?._id?.toString() || r.createdBy?.toString(),
                members: r.members?.map(m => m._id?.toString() || m.toString()) || []
            }))
        });

        // Return rooms directly - MongoDB query should already filter correctly
        // The query checks both createdBy and members, so all returned rooms are valid
        res.status(200).json({
            success: true,
            count: rooms.length,
            rooms,
        });
    } catch (error) {
        console.error("Error getting user rooms:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// UPDATE - Update room details
const updateRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { name, players, showMobileNumber, status } = req.body;
        const userId = req.user._id;

        // Find room and verify ownership
        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        const isCreator = room.createdBy.toString() === userId.toString();
        // Check membership - members array contains ObjectIds (could be populated or not)
        const isMember = room.members && room.members.length > 0 && room.members.some(
            (memberId) => {
                // Handle both ObjectId and populated User objects
                const id = memberId._id ? memberId._id.toString() : memberId.toString();
                return id === userId.toString();
            }
        );

        // Determine what type of update this is
        const isOnlyPlayerUpdate = players && Array.isArray(players) && !name && showMobileNumber === undefined && !status;
        const hasNonPlayerUpdates = name || showMobileNumber !== undefined || status;

        // Permission logic:
        // - Creator can always update anything
        // - Any member can update players (if only players field is being updated)
        // - Only creator can update other settings (name, status, showMobileNumber)

        if (isOnlyPlayerUpdate) {
            // Allow any member (including creator) to update players
            if (!isMember && !isCreator) {
                return res.status(403).json({
                    success: false,
                    message: "You are not a member of this room",
                });
            }
        } else if (hasNonPlayerUpdates) {
            // Only creator can update non-player fields
            if (!isCreator) {
                return res.status(403).json({
                    success: false,
                    message: "Only room admin can update room settings",
                });
            }
        } else if (!players) {
            // No valid update fields provided
            return res.status(400).json({
                success: false,
                message: "No valid fields to update",
            });
        }

        // Update room name (creator only)
        if (name) {
            if (name.trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    message: "Room name must be at least 3 characters",
                });
            }
            room.name = name.trim();
        }

        // Update players if provided (any member can add players)
        if (players && Array.isArray(players)) {
            const processedPlayers = [];
            // Preserve existing members - keep as ObjectIds for Mongoose
            const memberIds = [...room.members]; // Start with existing members (already ObjectIds)

            for (const player of players) {
                const normalizedMobile = normalizeMobile(player.mobile);

                // Check if player is an existing user
                let existingUser = null;
                if (player.id && !player.id.toString().startsWith('new-')) {
                    existingUser = await User.findById(player.id);
                }

                if (!existingUser) {
                    existingUser = await User.findOne({ mobile: normalizedMobile });
                }

                if (existingUser) {
                    processedPlayers.push({
                        userId: existingUser._id,
                        name: existingUser.displayName || player.name,
                        mobile: existingUser.mobile,
                    });

                    // Add to members if not already a member (check by string comparison)
                    const isAlreadyMember = memberIds.some(
                        (memberId) => memberId.toString() === existingUser._id.toString()
                    );
                    if (!isAlreadyMember) {
                        memberIds.push(existingUser._id);
                    }
                } else {
                    processedPlayers.push({
                        userId: null,
                        name: player.name.trim(),
                        mobile: normalizedMobile,
                    });
                }
            }

            room.players = processedPlayers;
            room.members = memberIds; // Keep as ObjectIds
        }

        // Update showMobileNumber (creator only)
        if (showMobileNumber !== undefined) {
            room.showMobileNumber = showMobileNumber;
        }

        // Update status (creator only)
        if (status && ['active', 'inactive'].includes(status)) {
            room.status = status;
        }

        await room.save();

        // Populate and return updated room
        const updatedRoom = await Room.findById(room._id)
            .populate('createdBy', 'username displayName mobile avatarUrl individualPoints')
            .populate('members', 'username displayName mobile avatarUrl individualPoints')
            .select('-__v');

        res.status(200).json({
            success: true,
            message: "Room updated successfully",
            room: updatedRoom,
        });
    } catch (error) {
        console.error("Error updating room:", error);

        if (error.name === "ValidationError") {
            const errors = Object.values(error.errors).map((el) => el.message);
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors,
            });
        }

        res.status(500).json({
            success: false,
            message: "Server error during room update",
            error: error.message,
        });
    }
};

// JOIN - Join a room by code
const joinRoom = async (req, res) => {
    try {
        const { roomCode } = req.body;
        const userId = req.user._id;

        if (!roomCode || !roomCode.trim()) {
            return res.status(400).json({
                success: false,
                message: "Room code is required",
            });
        }

        // Check if user already has an active room as creator (only creators are restricted)
        const existingActiveRoom = await Room.findOne({
            createdBy: userId,
            status: "active"
        });

        if (existingActiveRoom) {
            return res.status(400).json({
                success: false,
                message: "You already have an active room. Please deactivate it before joining another room.",
            });
        }

        // Find room by code
        const room = await Room.findOne({ code: roomCode.toUpperCase().trim() });

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found. Please check the room code.",
            });
        }

        // Check if room is active
        if (room.status !== "active") {
            return res.status(403).json({
                success: false,
                message: "This room is not active. Please contact the room admin.",
            });
        }

        // Check if user is already a member
        const isAlreadyMember = room.members.some(
            (memberId) => memberId.toString() === userId.toString()
        );

        if (isAlreadyMember) {
            // Return success even if already a member
            const populatedRoom = await Room.findById(room._id)
                .populate('createdBy', 'username displayName mobile avatarUrl individualPoints')
                .populate('members', 'username displayName mobile avatarUrl individualPoints')
                .select('-__v');

            return res.status(200).json({
                success: true,
                message: "You are already a member of this room",
                room: populatedRoom,
                requiresApproval: false,
            });
        }

        // Add user as member
        room.members.push(userId);
        await room.save();

        // Get user info to add as player if not already in players list
        const user = await User.findById(userId);
        if (user) {
            const isPlayerInRoom = room.players.some(
                (player) => player.userId && player.userId.toString() === userId.toString()
            );

            if (!isPlayerInRoom) {
                room.players.push({
                    userId: user._id,
                    name: user.displayName || user.username || 'Player',
                    mobile: user.mobile || '',
                });
                await room.save();
            }
        }

        // Populate and return room
        const populatedRoom = await Room.findById(room._id)
            .populate('createdBy', 'username displayName mobile avatarUrl individualPoints')
            .populate('members', 'username displayName mobile avatarUrl individualPoints')
            .select('-__v');

        res.status(200).json({
            success: true,
            message: "You have successfully joined the room!",
            room: populatedRoom,
            requiresApproval: false,
        });
    } catch (error) {
        console.error("Error joining room:", error);
        res.status(500).json({
            success: false,
            message: "Server error during room join",
            error: error.message,
        });
    }
};

// TOGGLE STATUS - Toggle room status (active/inactive)
const toggleRoomStatus = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user._id;

        // Find room and verify ownership
        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        // Check if user is the creator (admin)
        if (room.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only room admin can change room status",
            });
        }

        // Toggle status
        room.status = room.status === "active" ? "inactive" : "active";
        await room.save();

        // Populate and return updated room
        const updatedRoom = await Room.findById(room._id)
            .populate('createdBy', 'username displayName mobile avatarUrl individualPoints')
            .populate('members', 'username displayName mobile avatarUrl individualPoints')
            .select('-__v');

        res.status(200).json({
            success: true,
            message: `Room ${room.status === "active" ? "activated" : "deactivated"} successfully`,
            room: updatedRoom,
        });
    } catch (error) {
        console.error("Error toggling room status:", error);
        res.status(500).json({
            success: false,
            message: "Server error during room status update",
            error: error.message,
        });
    }
};

// DELETE - Delete a room
const deleteRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user._id;

        // Find room and verify ownership
        const room = await Room.findById(roomId);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        // Check if user is the creator (admin)
        if (room.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only room admin can delete the room",
            });
        }

        // Delete the room
        await Room.findByIdAndDelete(roomId);

        res.status(200).json({
            success: true,
            message: "Room deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting room:", error);
        res.status(500).json({
            success: false,
            message: "Server error during room deletion",
            error: error.message,
        });
    }
};

// Normalize mobile number helper
const normalizeMobileForLeaderboard = (mobile) => {
    if (!mobile) return '';
    const cleanMobile = mobile.replace(/[\s\-+()]/g, '');
    const normalizedMobile = cleanMobile.replace(/^91/, '');
    return normalizedMobile.slice(-10);
};

// GET - Get room leaderboard (top 3 players)
const getRoomLeaderboard = async (req, res) => {
    try {
        const { roomId } = req.params;

        // Find room
        const room = await Room.findById(roomId)
            .populate('members', 'username displayName avatarUrl mobile')
            .populate('createdBy', 'username displayName avatarUrl mobile');

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        // Get all completed games for this room (also check games that have finished matches)
        let completedGames = await Game.find({
            roomId: roomId,
            status: 'completed'
        }).populate('matches');

        // If no completed games found, also check games with finished status or games with all matches finished
        if (completedGames.length === 0) {
            const allRoomGames = await Game.find({
                roomId: roomId
            }).populate('matches');

            // Filter games that have medals assigned (indicating they're finished)
            completedGames = allRoomGames.filter(game =>
                game.medals && (
                    game.medals.gold?.team ||
                    game.medals.silver?.team ||
                    game.medals.bronze?.team
                )
            );
        }

        // Calculate points for each player from room games
        const playerPointsMap = new Map(); // key: userId or mobile, value: { name, avatar, points, userId, mobile, isRegistered }

        // Process each completed game
        for (const game of completedGames) {
            if (!game.teams || !Array.isArray(game.teams)) continue;

            // Process each team in the game
            for (const team of game.teams) {
                if (!team.players || !Array.isArray(team.players)) continue;

                for (const player of team.players) {
                    let playerKey = null;
                    let playerData = null;

                    if (player.userId) {
                        // Registered player
                        playerKey = `user_${player.userId.toString()}`;
                        const existing = playerPointsMap.get(playerKey);
                        if (!existing) {
                            // Fetch user details
                            const user = await User.findById(player.userId);
                            if (user) {
                                playerData = {
                                    userId: player.userId.toString(),
                                    name: user.displayName || user.username || player.name || 'Unknown',
                                    avatar: user.avatarUrl || null,
                                    points: 0,
                                    isRegistered: true,
                                    mobile: user.mobile || null
                                };
                            } else {
                                // User not found, use player data from game
                                playerData = {
                                    userId: player.userId.toString(),
                                    name: player.name || 'Unknown',
                                    avatar: null,
                                    points: 0,
                                    isRegistered: true,
                                    mobile: null
                                };
                            }
                        } else {
                            playerData = existing;
                        }
                    } else if (player.mobile) {
                        // Unregistered player
                        const normalizedMobile = normalizeMobileForLeaderboard(player.mobile);
                        playerKey = `mobile_${normalizedMobile}`;
                        const existing = playerPointsMap.get(playerKey);
                        if (!existing) {
                            playerData = {
                                userId: null,
                                name: player.name || 'Player',
                                avatar: null,
                                points: 0,
                                isRegistered: false,
                                mobile: normalizedMobile
                            };
                        } else {
                            playerData = existing;
                        }
                    }

                    if (!playerData) continue;

                    // Calculate points from medals
                    let isMedalWinner = false;
                    if (game.medals) {
                        for (const medalType of ['gold', 'silver', 'bronze']) {
                            const medalData = game.medals[medalType];
                            if (medalData && medalData.team === team.letter) {
                                const pointValues = {
                                    gold: 3,
                                    silver: 1,
                                    bronze: 1
                                };
                                playerData.points += pointValues[medalType] || 0;
                                isMedalWinner = true;
                            }
                        }
                    }

                    // Add participation points (0.5) if not a medal winner
                    // Also add match win points (1 point per match win)
                    if (!isMedalWinner) {
                        playerData.points += 0.5;
                    }

                    // Add match win points (1 point per match win from winning team)
                    if (team.wins && team.wins > 0) {
                        playerData.points += team.wins * 1;
                    }

                    playerPointsMap.set(playerKey, playerData);
                }
            }
        }

        console.log('🏆 [Leaderboard] Calculated points for', playerPointsMap.size, 'players from', completedGames.length, 'completed games');

        // Convert map to array and sort by points
        const leaderboard = Array.from(playerPointsMap.values())
            .filter(p => p.points > 0) // Only show players with points
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 3)
            .map((player, index) => ({
                ...player,
                rank: index + 1,
                points: Math.round(player.points * 10) / 10 // Round to 1 decimal
            }));

        console.log('🏆 [Leaderboard] Returning top', leaderboard.length, 'players');

        res.status(200).json({
            success: true,
            leaderboard: leaderboard,
        });
    } catch (error) {
        console.error("Error getting room leaderboard:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

export {
    createRoom,
    getRoomById,
    getRoomByCode,
    getUserRooms,
    updateRoom,
    joinRoom,
    toggleRoomStatus,
    deleteRoom,
    getRoomLeaderboard,
};

