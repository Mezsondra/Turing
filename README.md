<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Turing Test Challenge

A realistic Turing Test game where users chat with either a real human or an AI bot and try to guess which one they're talking to.

## Features

- **Real-time Matchmaking**: Users are randomly matched with either:
  - Another real person (Human vs Human)
  - An AI bot with dual behavior modes
- **Dual AI Behavior**:
  - **Human-like mode**: AI acts casual, uses slang, emojis, and occasional typos
  - **AI-like mode**: AI acts formal, structured, and assistant-like
- **WebSocket-based Chat**: Real-time messaging with typing indicators
- **Bilingual Support**: Available in English and Turkish
- **Score Tracking**: Track your ability to identify humans vs AI
- **Sound Effects & Haptic Feedback**: Enhanced user experience

## Architecture

### Backend (Node.js + Socket.io)
- WebSocket server for real-time communication
- Matchmaking queue system
- AI integration with Google Gemini API
- Session management and cleanup

### Frontend (React + TypeScript)
- React-based UI with real-time updates
- Socket.io client for WebSocket communication
- Responsive design with TailwindCSS

## Run Locally

**Prerequisites:** Node.js 16+

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Open [.env.local](.env.local) file
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```
   - Get your API key from: https://aistudio.google.com/apikey

3. **Run the app:**

   **Option A: Run both server and client together (recommended):**
   ```bash
   npm run dev:all
   ```

   **Option B: Run separately:**
   ```bash
   # Terminal 1 - Start the backend server
   npm run server

   # Terminal 2 - Start the frontend
   npm run dev
   ```

4. **Open your browser:**
   - Frontend: http://localhost:5173
   - Backend health check: http://localhost:3001/health

## How It Works

1. **User joins** the matchmaking queue
2. **Matchmaking logic**:
   - If another user is waiting → Match them together (Human vs Human)
   - 50% random chance to match with AI immediately
   - If no match after 5 seconds → Match with AI
3. **AI Behavior**:
   - Randomly assigned to act either human-like or AI-like
   - Users must identify which they're talking to
4. **After 60 seconds**: Users guess if their partner was human or AI
5. **Score**: Points awarded for correct guesses

## Testing with Multiple Users

To test the human-to-human matchmaking:

1. Open multiple browser windows/tabs
2. Start chatting in each window
3. They should be matched together if they join around the same time

## Project Structure

```
.
├── server/                 # Backend Node.js server
│   ├── index.ts           # Main server & Socket.io handlers
│   ├── matchmaking.ts     # Matchmaking queue logic
│   ├── aiService.ts       # AI integration
│   └── types.ts           # Backend types
├── components/            # React components
├── services/              # Frontend services
│   └── socketService.ts   # WebSocket client
├── translations/          # i18n translations
└── .env.local            # Environment variables
```

## Environment Variables

- `GEMINI_API_KEY`: Your Google Gemini API key
- `PORT`: Server port (default: 3001)
- `CLIENT_URL`: Frontend URL for CORS (default: http://localhost:5173)
- `VITE_SERVER_URL`: Backend WebSocket URL (default: http://localhost:3001)

## Contributing

Feel free to open issues or submit pull requests!

## License

MIT
