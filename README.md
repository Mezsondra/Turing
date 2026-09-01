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
   - Copy `.env.local.example` to `.env.local`
   - `GEMINI_API_KEY` - get one from https://aistudio.google.com/apikey
   - `JWT_SECRET` and `ADMIN_PASSWORD` - **required**; the server refuses to
     start without them. Generate with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

   Env vars are loaded by node's `--env-file` flag, not by `dotenv` - ES modules
   evaluate imports before any module body, so a `dotenv.config()` call in
   `server/index.ts` would run too late to be seen by imported modules.

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

## Deploying to your own server

The built frontend is served by the same Express process as the API, so there is
one service to run on one port.

```bash
git clone <repo> /srv/turing && cd /srv/turing
npm ci          # build on the server: better-sqlite3 is a native module and a
                # macOS build will not load on Linux
cp .env.local.example .env.local && $EDITOR .env.local
npm run build   # emits dist/, which the server serves
```

Edit `.env.local` **before** building. `VITE_*` variables are compiled into the
bundle, not read at runtime, so changing one means running `npm run build`
again. In particular leave `VITE_SERVER_URL` unset: the server serves the
frontend from its own origin. If the bundle carries `http://localhost:3001`
(`grep -o localhost:3001 dist/assets/*.js`) the browser will call your laptop
instead of the server and every page, admin included, reports "Failed to
connect to server". Set `CLIENT_URL` to your public HTTPS URL.

To deploy a later change, install first - a commit that adds a dependency will
otherwise fail the build against a stale `node_modules`:

```bash
git pull && npm install && npm run build && pm2 restart turing
```

`npm run sync` is **not** a deploy command. It builds the mobile app: it bakes
an absolute `VITE_SERVER_URL` into `dist/`, which is wrong for a server that
serves the frontend from its own origin.

Then use the files in [deploy/](deploy/):

- `turing.service` - systemd unit (auto-restart, starts on boot)
- `Caddyfile` - TLS + WebSocket reverse proxy, certificates handled automatically
- `backup.sh` - nightly integrity-checked SQLite backup for cron (30-day local retention)

Set `DATABASE_PATH=/sdc/turing/turing.db` in production and make sure the service
user owns the whole directory (`chown -R turing:turing /sdc/turing`) - SQLite
creates `turing.db-wal` and `turing.db-shm` alongside the
database, so it needs write permission on the folder, not just the file.

The backup job defaults to `/var/backups/turing`. It validates every backup
before publishing it, but the selected deployment keeps backups on the same
host; losing the host can therefore still lose both the database and backups.
For the versioned schema preflight, migration, verification, and rollback
commands, follow [deploy/DATABASE_ROLLOUT.md](deploy/DATABASE_ROLLOUT.md).

**Scaling ceiling:** matches live in memory and the database is a local file, so
this runs as exactly one instance. That is fine well past launch; move matches to
Redis and the database to Postgres only when one machine stops coping.
