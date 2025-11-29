import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
    {
        gameId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Game",
            required: true
        },
        roundNumber: {
            type: Number,
            required: true,
            default: 1
        },
        matchNumber: {
            type: Number,
            required: true
        },
        teamA: {
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
                    name: String,
                    mobile: String
                }
            ],
            points: {
                type: Number,
                default: 0
            }
        },
        teamB: {
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
                    name: String,
                    mobile: String
                }
            ],
            points: {
                type: Number,
                default: 0
            }
        },
        scoreA: {
            type: Number,
            default: null
        },
        scoreB: {
            type: Number,
            default: null
        },
        winner: {
            type: String,
            enum: ["A", "B", null],
            default: null
        },
        status: {
            type: String,
            enum: ["pending", "live", "finished"],
            default: "pending"
        },
        bracketType: {
            type: String,
            enum: ["winners", "losers", "semifinal", "bronze", "final", null],
            default: null
        },
        isBye: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

export default mongoose.model("Match", matchSchema);

