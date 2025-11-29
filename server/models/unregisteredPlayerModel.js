import mongoose from "mongoose";

const statsSchema = new mongoose.Schema(
    {
        totalGames: { type: Number, default: 0 },
        totalWins: { type: Number, default: 0 },
        streak: { type: Number, default: 0 }
    },
    { _id: false }
);

const unregisteredPlayerSchema = new mongoose.Schema(
    {
        mobile: {
            type: String,
            required: true,
            unique: true,
            index: true // For faster lookups
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        // Pending points that will be transferred when user registers
        pendingIndividualPoints: {
            type: Number,
            default: 0
        },
        pendingTeamPoints: {
            type: Number,
            default: 0
        },
        // Pending stats
        pendingStats: {
            type: statsSchema,
            default: () => ({})
        },
        // Track which games, matches, and rooms they're in
        gameIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Game"
        }],
        matchIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Match"
        }],
        roomIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room"
        }],
        // Track if this player has been linked to a user
        linkedToUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        linkedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

// Index for faster queries
unregisteredPlayerSchema.index({ mobile: 1 });
unregisteredPlayerSchema.index({ linkedToUserId: 1 });

export default mongoose.model("UnregisteredPlayer", unregisteredPlayerSchema);

