# 🏓 PickleMatch

**Social Pickleball Tournament App**

A mobile-first platform for pickleball groups that organizes matches, shuffles teams, tracks winners, and maintains comprehensive player statistics.

## ✨ Features

- **Room Management** - Create/join rooms with unique codes
- **Multiple Game Formats** - 1v1, 2v2, Pickle, Round Robin, Quick Knockout
- **Smart Team Shuffling** - Automatic fair team assignment
- **Points & Medal System** - Track individual and team points
- **Global Leaderboards** - Top players with sorting (Points, Wins, Streak)
- **Player Search** - Find players by name, username, or phone
- **Friend System** - Add friends and view profiles
- **Unregistered Player Support** - Seamless data migration on registration
- **Game History** - Complete match history across all rooms
- **Statistics Tracking** - Games, wins, streaks, win percentage

## 🛠️ Tech Stack

- **Frontend**: React Native (Expo), React Navigation
- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Authentication**: JWT
- **State Management**: React Hooks, Context API

## 📱 Platforms

iOS, Android, Web

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Expo CLI

### Installation

1. Clone the repository
```bash
git clone https://github.com/vamshigadde09/PickleMatch.git
cd PickleMatch
```

2. Install dependencies
```bash
# Frontend
cd pickleball
npm install

# Backend
cd ../server
npm install
```

3. Set up environment variables
```bash
# Backend .env file
MONGO_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
```

4. Start the development servers
```bash
# Backend
cd server
npm run dev

# Frontend (in another terminal)
cd pickleball
npm start
```

## 📖 Documentation

See `prd.txt` for comprehensive product requirements and documentation.

## 📝 License

ISC

## 👥 Author

Development Team

