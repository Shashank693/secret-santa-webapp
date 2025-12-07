const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const rooms = {}; // in-memory store

function normalizeName(name) {
  name = name.trim();
  if (!name) return null;
  const first = name.split(/\s+/)[0];
  return first.toUpperCase();
}

function derange(list) {
  const n = list.length;
  if (n < 2) return null;
  const shift = Math.floor(Math.random() * (n - 1)) + 1;
  return list.map((_, i) => list[(i + shift) % n]);
}

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function random4Digit() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// create-room
app.post("/api/create-room", (req, res) => {
  let { organizerName, includeOrganizer, members } = req.body;

  members = (members || []).map(normalizeName).filter(Boolean);
  if (includeOrganizer) {
    const org = normalizeName(organizerName || "ORGANIZER");
    if (org) members.push(org);
  }

  members = [...new Set(members)];
  if (members.length < 2) {
    return res.status(400).json({ error: "Need at least 2 unique players" });
  }

  const giftees = derange(members);
  const assignments = {};
  const codes = {};
  const usedCodes = new Set();

  members.forEach((name, i) => {
    assignments[name] = giftees[i];
    let c;
    do { c = random4Digit(); } while (usedCodes.has(c));
    usedCodes.add(c);
    codes[name] = c;
  });

  const roomCode = randomRoomCode();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  rooms[roomCode] = { members, assignments, codes, expiresAt };

  res.json({ roomCode, codes, expiresAt });
});

// join-room
app.get("/api/join-room/:roomCode", (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase();
  const room = rooms[roomCode];

  if (!room) return res.status(404).json({ error: "Room not found" });
  if (Date.now() > room.expiresAt) {
    delete rooms[roomCode];
    return res.status(410).json({ error: "Room expired" });
  }

  res.json({ members: room.members, expiresAt: room.expiresAt });
});

// reveal
app.post("/api/reveal", (req, res) => {
  const { roomCode, name, code } = req.body;
  const key = (roomCode || "").toUpperCase();
  const room = rooms[key];

  if (!room) return res.status(404).json({ error: "Room not found" });
  if (Date.now() > room.expiresAt) {
    delete rooms[key];
    return res.status(410).json({ error: "Room expired" });
  }

  const normName = normalizeName(name || "");
  if (!room.members.includes(normName)) {
    return res.status(400).json({ error: "Name not in this room" });
  }
  if (room.codes[normName] !== String(code || "").trim()) {
    return res.status(403).json({ error: "Wrong secret code" });
  }

  res.json({ giftTo: room.assignments[normName] });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
