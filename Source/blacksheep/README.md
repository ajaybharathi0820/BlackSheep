# BlackSheep - Online Multiplayer Game

A social deduction game where players must find the imposter among them using word clues.

## Game Overview

- **Players**: 4-10 players
- **Objective**: Find the imposter or survive as the imposter
- **Gameplay**: Give clues, discuss, vote to eliminate suspected imposters

### How to Play

1. **Create/Join Room**: Host creates a room, others join with room code
2. **Word Assignment**: One player becomes the imposter with a different word
3. **Clue Phase**: Players give clues about their word without saying it
4. **Voting Phase**: Vote for who you think is the imposter
5. **Win Conditions**:
   - Civilians win if all imposters are eliminated
   - Imposter wins if they survive to the final 2 players

## Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Database**: Firebase Firestore (real-time)
- **Icons**: Lucide React

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- Firebase project created

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Firestore Database
4. Go to Project Settings → General → Your apps
5. Add a web app and copy the configuration

### 2. Environment Configuration

Create a `.env.local` file in the root directory and add your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Firebase Firestore Rules

Set up these security rules in your Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to rooms
    match /rooms/{roomId} {
      allow read, write: if true;
      
      // Allow read/write access to messages in rooms
      match /messages/{messageId} {
        allow read, write: if true;
      }
    }
  }
}
```

*Note: These are permissive rules for development. In production, implement proper authentication and security rules.*

## Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── page.tsx        # Home page
│   └── room/[id]/      # Dynamic room pages
├── components/         # React components
│   ├── CreateRoomModal.tsx
│   ├── JoinRoomModal.tsx
│   ├── Lobby.tsx
│   ├── GameBoard.tsx
│   └── Results.tsx
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── data/               # Game data (word pairs)
└── lib/                # Configuration files
```

## Features

- ✅ Real-time multiplayer rooms
- ✅ Room creation and joining with codes
- ✅ Live chat during gameplay
- ✅ Real-time voting system
- ✅ Game state management
- ✅ Word assignment system with no repetition (290+ unique word pairs)
- ✅ Host controls (reset words, start voting)
- ✅ Elimination and win condition logic
- ✅ Results display with role reveals
- ✅ Hold-to-reveal word functionality
- ✅ Optional imposter role visibility
- ✅ Quit game functionality
- ✅ Responsive design

## Game Flow

1. **Lobby Phase**: Players join and wait for host to start
2. **Clue Phase**: Players give clues about their assigned words
3. **Voting Phase**: Players vote to eliminate suspected imposters
4. **Results Phase**: Show voting results and elimination
5. **Continue or End**: Game continues until win condition is met

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed on any platform that supports Next.js applications.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

---

**Have fun playing BlackSheep! 🐑**
