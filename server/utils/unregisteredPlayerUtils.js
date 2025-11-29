import UnregisteredPlayer from "../models/unregisteredPlayerModel.js";
import User from "../models/userModel.js";

const normalizeMobile = (mobile) => {
    const cleanMobile = mobile.replace(/[\s\-+()]/g, '');
    const normalizedMobile = cleanMobile.replace(/^91/, '');
    return normalizedMobile.slice(-10);
};

// Generate a unique system name for privacy (e.g., "user1234")
// This replaces personal names/nicknames with anonymous identifiers
// Ensures uniqueness by checking against existing usernames and system names
const generateSystemName = async () => {
    let attempts = 0;
    const maxAttempts = 100; // Prevent infinite loops

    while (attempts < maxAttempts) {
        // Generate 4-digit random number (0000-9999)
        const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const systemName = `user${randomNumber}`;

        // Check if this system name already exists as a username (must be unique)
        const existingUser = await User.findOne({
            username: systemName.toLowerCase()
        });

        // Check if this system name already exists in UnregisteredPlayer records
        // (to ensure we don't assign the same system name to multiple users)
        const existingSystemName = await UnregisteredPlayer.findOne({
            name: systemName,
            linkedToUserId: { $ne: null } // Only check linked records (active system names)
        });

        // If name doesn't conflict with any username or existing system name, it's unique
        if (!existingUser && !existingSystemName) {
            return systemName;
        }

        attempts++;
    }

    // Fallback: Use timestamp + random for guaranteed uniqueness
    // This ensures we always get a unique name even if many exist
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits for better uniqueness
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const uniqueName = `user${timestamp}${randomSuffix}`;

    // Double-check this fallback name is unique
    const existing = await User.findOne({
        username: uniqueName.toLowerCase()
    });

    if (!existing) {
        return uniqueName;
    }

    // Final fallback: timestamp only (guaranteed unique)
    return `user${Date.now()}`;
};

// Get or create an unregistered player by mobile
// IMPORTANT: Matching is by MOBILE NUMBER ONLY - name is just for display/reference
// The same mobile number will always find the same record, regardless of name differences
const getOrCreateUnregisteredPlayer = async (mobile, name) => {
    const normalizedMobile = normalizeMobile(mobile);

    // Find by mobile number only (name is not used for matching)
    let unregisteredPlayer = await UnregisteredPlayer.findOne({
        mobile: normalizedMobile,
        linkedToUserId: null // Only get unlinked players
    });

    if (!unregisteredPlayer) {
        // Create new record with provided name (first name entered is kept)
        unregisteredPlayer = new UnregisteredPlayer({
            mobile: normalizedMobile,
            name: name.trim()
        });
        await unregisteredPlayer.save();
    }
    // IMPORTANT: Name is NEVER updated - keep the first name that was entered
    // This preserves the original name even if added with different names later
    // Example: "Amma" stays "Amma" even if later someone adds "Vandhana" (same phone)

    return unregisteredPlayer;
};

// Add points to an unregistered player
const addPointsToUnregisteredPlayer = async (mobile, points) => {
    const normalizedMobile = normalizeMobile(mobile);

    await UnregisteredPlayer.updateOne(
        {
            mobile: normalizedMobile,
            linkedToUserId: null
        },
        {
            $inc: { pendingIndividualPoints: points }
        }
    );
};

// Track game/match/room participation
const trackUnregisteredPlayerParticipation = async (mobile, { gameId, matchId, roomId }) => {
    const normalizedMobile = normalizeMobile(mobile);
    const updateData = {};

    if (gameId) {
        updateData.$addToSet = { gameIds: gameId };
    }
    if (matchId) {
        updateData.$addToSet = { ...updateData.$addToSet, matchIds: matchId };
    }
    if (roomId) {
        updateData.$addToSet = { ...updateData.$addToSet, roomIds: roomId };
    }

    if (Object.keys(updateData).length > 0) {
        await UnregisteredPlayer.updateOne(
            {
                mobile: normalizedMobile,
                linkedToUserId: null
            },
            updateData
        );
    }
};

// Update stats for unregistered player
const updateUnregisteredPlayerStats = async (mobile, { totalGames = 0, totalWins = 0 }) => {
    const normalizedMobile = normalizeMobile(mobile);

    const updateData = {};
    if (totalGames > 0) {
        updateData.$inc = { 'pendingStats.totalGames': totalGames };
    }
    if (totalWins > 0) {
        updateData.$inc = { 'pendingStats.totalWins': totalWins };
    }

    if (Object.keys(updateData).length > 0) {
        await UnregisteredPlayer.updateOne(
            {
                mobile: normalizedMobile,
                linkedToUserId: null
            },
            updateData
        );
    }
};

// Transfer all data from UnregisteredPlayer to User and link records
// IMPORTANT: Matching is done by MOBILE NUMBER ONLY, not by name
// Returns system name to be used when replacing names for privacy
const transferUnregisteredPlayerToUser = async (userId, normalizedMobile, systemName) => {
    // Find the unregistered player by mobile number only (name is ignored for matching)
    const unregisteredPlayer = await UnregisteredPlayer.findOne({
        mobile: normalizedMobile,
        linkedToUserId: null
    });

    if (!unregisteredPlayer) {
        return {
            found: false,
            message: "No unregistered player data found for this mobile number"
        };
    }

    const result = {
        found: true,
        individualPoints: unregisteredPlayer.pendingIndividualPoints || 0,
        teamPoints: unregisteredPlayer.pendingTeamPoints || 0,
        stats: unregisteredPlayer.pendingStats || {},
        gameIds: unregisteredPlayer.gameIds || [],
        matchIds: unregisteredPlayer.matchIds || [],
        roomIds: unregisteredPlayer.roomIds || [],
        gamesLinked: unregisteredPlayer.gameIds?.length || 0,
        matchesLinked: unregisteredPlayer.matchIds?.length || 0,
        roomsLinked: unregisteredPlayer.roomIds?.length || 0,
        systemName: systemName // Return system name to use for privacy
    };

    // Update name to system-generated name for privacy (e.g., "Amma" → "user1234")
    unregisteredPlayer.name = systemName;

    // Mark as linked (don't delete - keep for history/audit)
    unregisteredPlayer.linkedToUserId = userId;
    unregisteredPlayer.linkedAt = new Date();
    await unregisteredPlayer.save();

    return result;
};

export {
    getOrCreateUnregisteredPlayer,
    addPointsToUnregisteredPlayer,
    trackUnregisteredPlayerParticipation,
    updateUnregisteredPlayerStats,
    transferUnregisteredPlayerToUser,
    normalizeMobile,
    generateSystemName
};

