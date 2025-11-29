import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
    {
        letter: {
            type: String,
            required: true
        },
        players: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    default: null
                },
                name: {
                    type: String,
                    required: true
                },
                mobile: String,
                playsTwice: {
                    type: Boolean,
                    default: false
                }
            }
        ],
        totalPoints: {
            type: Number,
            default: 0
        },
        wins: {
            type: Number,
            default: 0
        },
        medal: {
            type: String,
            enum: ["gold", "silver", "bronze", null],
            default: null
        }
    },
    { _id: false }
);

const gameSchema = new mongoose.Schema(
    {
        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            required: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        type: {
            type: String,
            enum: ["pickle", "round-robin", "quick-knockout", "one-vs-one", "two-vs-two"],
            required: true
        },
        teams: [teamSchema],
        matches: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Match"
            }
        ],
        currentRound: {
            type: Number,
            default: 1
        },
        championTeam: {
            type: String,
            default: null
        },
        medals: {
            gold: {
                team: String,
                players: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                }]
            },
            silver: {
                team: String,
                players: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                }]
            },
            bronze: {
                team: String,
                players: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                }]
            }
        },
        pointsAssigned: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ["pending", "live", "completed"],
            default: "pending"
        }
    },
    { timestamps: true }
);

export default mongoose.model("Game", gameSchema);

