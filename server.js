// backend/server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Config
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
const DATA_PATH = path.join(__dirname, "data.json");

// Helper: read/write data.json
function readData() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  return JSON.parse(raw);
}
function writeData(obj) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(obj, null, 2));
}

// Auth middleware
function checkAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "Authorization header missing" });
  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token missing" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ----------------- LOGIN -----------------
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const data = readData();
    const user = data.users.find(u => u.username === username);
    if (!user) return res.status(401).json({ message: "Invalid username or password" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid username or password" });

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------- ITEMS APIs -----------------
// Get all items
app.get("/items", (req, res) => {
  const { items } = readData();
  res.json(items);
});

// Get single item
app.get("/items/:id", (req, res) => {
  const id = Number(req.params.id);
  const { items } = readData();
  const item = items.find(i => i.id === id);
  if (!item) return res.status(404).json({ message: "Item not found" });
  res.json(item);
});

// Add item (admin only)
app.post("/items", checkAuth, (req, res) => {
  const body = req.body;
  if (!body.name || !body.location) {
    return res.status(400).json({ message: "Missing name or location" });
  }
  const data = readData();
  const newItem = {
    id: data.items.length ? data.items[data.items.length - 1].id + 1 : 1,
    name: body.name,
    price: body.price || 0,
    floor: body.floor || 1,
    location: body.location
  };
  data.items.push(newItem);
  writeData(data);
  res.json({ message: "Item added", item: newItem });
});

// ----------------- SHORTEST PATH -----------------
// Simple BFS on a grid. Assumes start/end {x,y} inside grid
// Accepts optional gridSize (default 10) and obstacles array [{x,y},...]
app.post("/path", (req, res) => {
  try {
    const { start, end, gridSize = 10, obstacles = [] } = req.body;
    if (!start || !end) return res.status(400).json({ message: "start and end required" });

    const isObstacle = (x,y) => obstacles.some(o => o.x === x && o.y === y);

    const visited = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
    const q = [{ x: start.x, y: start.y, path: [] }];
    visited[start.y][start.x] = true;

    const neighbors = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    while (q.length) {
      const curr = q.shift();
      const { x, y, path } = curr;
      if (x === end.x && y === end.y) {
        return res.json({ shortestPath: [...path, { x, y }] });
      }

      for (const d of neighbors) {
        const nx = x + d.x, ny = y + d.y;
        if (nx >= 0 && ny >= 0 && nx < gridSize && ny < gridSize && !visited[ny][nx] && !isObstacle(nx,ny)) {
          visited[ny][nx] = true;
          q.push({ x: nx, y: ny, path: [...path, { x, y }] });
        }
      }
    }

    return res.json({ message: "No path found" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ----------------- SIMPLE HEALTH -----------------
app.get("/", (req, res) => res.send({ ok: true, message: "In-store navigation backend" }));

// Start
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
