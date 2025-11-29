import mongoose from "mongoose";

const statsSchema = new mongoose.Schema(
    {
        totalGames: { type: Number, default: 0 },
        totalWins: { type: Number, default: 0 },
        streak: { type: Number, default: 0 }
    },
    { _id: false }
);

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        displayName: {
            type: String,
            required: true,
            trim: true
        },
        mobile: {
            type: String,
            required: true,
            unique: true
        },
        passwordHash: {
            type: String,
            required: true
        },
        showMobile: {
            type: Boolean,
            default: false
        },
        friends: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        individualPoints: {
            type: Number,
            default: 0
        },
        teamPoints: {
            type: Number,
            default: 0
        },
        stats: {
            type: statsSchema,
            default: () => ({})
        },
        avatarUrl: String
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);

