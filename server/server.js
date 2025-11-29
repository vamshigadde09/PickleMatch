import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import topScoresRoutes from "./routes/topScoresRoutes.js";

dotenv.config();

// Ensure JWT_SECRET is set
if (!process.env.JWT_SECRET) {
    console.warn("Warning: JWT_SECRET is not set in environment variables. Using default secret.");
    process.env.JWT_SECRET = 'your-super-secret-key-123';
}

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);

        // Allow localhost and local network IPs
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5000',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5000',
            /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Allow local network IPs
            /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,  // Allow 10.x.x.x network
        ];

        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return allowed === origin;
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            // For development, allow all origins
            callback(null, true);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`, {
        headers: req.headers.authorization ? 'Auth: Yes' : 'Auth: No',
        origin: req.headers.origin || 'No origin',
    });
    next();
});

// Health check route
app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is running",
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/room", roomRoutes);
app.use("/api/v1/game", gameRoutes);
app.use("/api/v1/top-scores", topScoresRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? err.message : undefined
    });
});

// 404 handler - must be last
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;
