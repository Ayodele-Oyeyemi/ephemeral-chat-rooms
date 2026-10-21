# Ephemeral Chat & Polling Rooms

A small full-stack real-time chat and polling app. Rooms, messages, and polls are held in server memory and automatically expire after 30 minutes without activity once empty. Restarting the server clears all rooms.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

1. Install all workspace dependencies from the repository root:

   ```bash
   npm install
   ```

2. (Optional) Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`, then adjust the values if needed. For deployment, set `CLIENT_URL` on the server to the frontend origin and `VITE_SERVER_URL` on the client to the backend origin. Defaults work for local development.

3. Start both applications:

   ```bash
   npm run dev
   ```

   The Vite client is available at [http://localhost:5173](http://localhost:5173), and the API/Socket.IO server listens on port `3001`.

You can also run only one side with `npm run dev:server` or `npm run dev:client`. To build the frontend, run `npm run build`; to start the backend outside development mode, run `npm start`.

## Room behavior

Create a room with a name or join one using its five-character code. Share the code with others to chat and vote together. Each browser session has a stable participant ID, and each participant can vote once per poll. Creating a new poll resets its vote totals. Rooms are stored only in memory and are deleted after 30 minutes of inactivity when they have no connected participants.

## Environment variables

See `server/.env.example` and `client/.env.example`. Set the client's `VITE_SERVER_URL` to the backend origin and the server's `CLIENT_URL` to the frontend origin.
