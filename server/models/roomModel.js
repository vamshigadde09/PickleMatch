import mongoose from "mongoose";

const playerSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        mobile: {
            type: String,
            required: true
        }
    },
    { _id: false }
);

const roomSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        players: [playerSchema],
        showMobileNumber: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        },
        history: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Game"
            }
        ]
    },
    { timestamps: true }
);

export default mongoose.model("Room", roomSchema);

