import { randomInt } from "node:crypto";

const rooms = new Map();
const ROOM_CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 30 * 60 * 1000;

function makeRoomCode() {
  let roomCode;
  do {
    roomCode = Array.from(
      { length: 5 },
      () => ROOM_CODE_CHARACTERS[randomInt(ROOM_CODE_CHARACTERS.length)],
    ).join("");
  } while (rooms.has(roomCode));
  return roomCode;
}

export function createRoom(name) {
  const room = {
    roomCode: makeRoomCode(),
    name,
    messages: [],
    poll: null,
    members: new Set(),
    lastActivityAt: Date.now(),
  };
  rooms.set(room.roomCode, room);
  return room;
}

export function getRoom(roomCode) {
  return rooms.get(roomCode);
}

export function touchRoom(room) {
  room.lastActivityAt = Date.now();
}

export function serializeRoom(room) {
  return {
    roomCode: room.roomCode,
    name: room.name,
    messages: room.messages,
    poll: room.poll,
  };
}

export function removeExpiredRooms() {
  const now = Date.now();
  for (const [roomCode, room] of rooms) {
    if (room.members.size === 0 && now - room.lastActivityAt >= ROOM_TTL_MS) {
      rooms.delete(roomCode);
    }
  }
}
