import "dotenv/config";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import {
  createRoom,
  getRoom,
  removeExpiredRooms,
  serializeRoom,
  touchRoom,
} from "./roomStore.js";

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "*";
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ["GET", "POST"] },
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/rooms", (request, response) => {
  const name = typeof request.body?.name === "string" ? request.body.name.trim() : "";
  if (!name || name.length > 60) {
    response.status(400).json({ error: "Room name must be between 1 and 60 characters." });
    return;
  }

  const room = createRoom(name);
  response.status(201).json({ roomCode: room.roomCode, name: room.name });
});

function getSocketRoom(socket) {
  const roomCode = socket.data.roomCode;
  return roomCode ? getRoom(roomCode) : undefined;
}

function leaveCurrentRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const room = getRoom(roomCode);
  if (room) {
    room.members.delete(socket.id);
    touchRoom(room);
  }
  socket.leave(roomCode);
  delete socket.data.roomCode;
  delete socket.data.participantId;
}

io.on("connection", (socket) => {
  socket.on("join_room", (payload) => {
    const roomCode =
      typeof payload?.roomCode === "string" ? payload.roomCode.trim().toUpperCase() : "";
    const participantId =
      typeof payload?.participantId === "string" ? payload.participantId.trim() : "";
    const displayName =
      typeof payload?.displayName === "string" ? payload.displayName.trim().slice(0, 32) : "";
    const room = getRoom(roomCode);

    if (!room || !participantId || participantId.length > 100 || !displayName) {
      socket.emit("room_error", { message: "That room or participant could not be found." });
      return;
    }

    if (socket.data.roomCode !== roomCode) leaveCurrentRoom(socket);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.participantId = participantId;
    socket.data.displayName = displayName;
    room.members.add(socket.id);
    touchRoom(room);
    socket.emit("room_state", serializeRoom(room));
  });

  socket.on("send_message", (payload) => {
    const room = getSocketRoom(socket);
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    if (!room || !text || text.length > 2000) return;

    const message = {
      id: randomUUID(),
      sender: socket.data.displayName || "Guest",
      text,
      timestamp: new Date().toISOString(),
    };

    room.messages.push(message);
    if (room.messages.length > 500) room.messages.shift();
    touchRoom(room);
    io.to(room.roomCode).emit("message_received", message);
  });

  socket.on("create_poll", (payload) => {
    const room = getSocketRoom(socket);
    const question = typeof payload?.question === "string" ? payload.question.trim() : "";
    const rawOptions = Array.isArray(payload?.options) ? payload.options : [];
    const options = rawOptions
      .filter((option) => typeof option === "string")
      .map((text) => text.trim())
      .filter(Boolean);
    if (!room || !question || question.length > 240 || options.length < 2 || options.length > 8) {
      socket.emit("room_error", { message: "A poll needs a question and 2 to 8 options." });
      return;
    }
    if (options.some((option) => option.length > 100)) {
      socket.emit("room_error", { message: "Poll options must be 100 characters or fewer." });
      return;
    }

    room.poll = {
      question,
      options: options.map((text) => ({ id: randomUUID(), text, votes: 0 })),
      votedUsers: [],
    };
    touchRoom(room);
    io.to(room.roomCode).emit("poll_updated", room.poll);
  });

  socket.on("vote_poll", (payload) => {
    const room = getSocketRoom(socket);
    const participantId = socket.data.participantId;
    if (!room?.poll || !participantId || room.poll.votedUsers.includes(participantId)) return;

    const option = room.poll.options.find((item) => item.id === payload?.optionId);
    if (!option) return;
    option.votes += 1;
    room.poll.votedUsers.push(participantId);
    touchRoom(room);
    io.to(room.roomCode).emit("poll_updated", room.poll);
  });

  socket.on("leave_room", () => leaveCurrentRoom(socket));
  socket.on("disconnect", () => leaveCurrentRoom(socket));
});

setInterval(removeExpiredRooms, 5 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  console.log(`Chat server listening on http://localhost:${PORT}`);
});
