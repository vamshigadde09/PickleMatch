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

## 📦 Building & Publishing with EAS

### Prerequisites

1. **EAS CLI is installed and initialized** ✅ (Already done)
2. **Project is linked to Expo** ✅ (Project ID: 604fb50a-4640-4796-9ad0-081f858a214a)

### Build Commands

**Build for Android (APK for testing):**
```bash
cd pickleball
eas build --platform android --profile preview
```

**Build for Android (AAB for Play Store):**
```bash
eas build --platform android --profile production
```

**Build for iOS:**
```bash
eas build --platform ios --profile production
```

**Build for both platforms:**
```bash
eas build --platform all --profile production
```

### Submit to App Stores

After building, submit to stores:

**Android (Google Play Store):**
```bash
eas submit --platform android
```

**iOS (App Store):**
```bash
eas submit --platform ios
```

### Build Profiles

- **preview**: Creates APK/IPA files for internal testing
- **production**: Creates AAB (Android) / IPA (iOS) for app store submission

### Monitor Builds

View your builds at: https://expo.dev/accounts/vamshigadde/projects/picklematch/builds

## 🌐 Production Backend

The app is configured to use the production backend hosted on Vercel:
- **Backend URL**: https://pickle-match.vercel.app/

**Note:** The frontend is configured to use the production backend. To use a local backend, update `pickleball/src/api.js` with your local server URL.

## 📖 Documentation

See `prd.txt` for comprehensive product requirements and documentation.

## 📝 License

ISC

## 👥 Author

Development Team

