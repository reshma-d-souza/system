// frontend/script.js

const API_BASE = "http://localhost:3000"; // change on deploy if needed
let token = null;
let items = [];
let gridSize = 10;
let start = null;
let end = null;

// DOM
const itemsList = document.getElementById("itemsList");
const refreshBtn = document.getElementById("refreshBtn");
const loginBtn = document.getElementById("loginBtn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginMsg = document.getElementById("loginMsg");
const addItemBox = document.getElementById("addItemBox");
const addItemBtn = document.getElementById("addItemBtn");
const addMsg = document.getElementById("addMsg");
const mapEl = document.getElementById("map");
const clearBtn = document.getElementById("clearBtn");

// init
refreshBtn.onclick = loadItems;
loginBtn.onclick = login;
addItemBtn.onclick = addItem;
clearBtn.onclick = clearSelection;

function setToken(t) {
  token = t;
  if (token) {
    addItemBox.classList.remove("hidden");
  } else {
    addItemBox.classList.add("hidden");
  }
}

// Load items from backend
async function loadItems() {
  try {
    const res = await fetch(API_BASE + "/items");
    items = await res.json();
    renderItems();
    renderMap();
  } catch (err) {
    console.error(err);
    alert("Unable to load items from backend. Is it running?");
  }
}

function renderItems() {
  itemsList.innerHTML = "";
  for (const it of items) {
    const li = document.createElement("li");
    li.textContent = `${it.name} — ₹${it.price} (Floor ${it.floor}) [${it.location.x},${it.location.y}]`;
    li.onclick = () => {
      // set as destination
      end = it.location;
      if (!start) alert("Click a cell on the map to pick start, or click Clear and click start then click this item to set end.");
      else computePath();
    };
    itemsList.appendChild(li);
  }
}

// Login
async function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  if (!username || !password) {
    loginMsg.textContent = "Enter username and password";
    return;
  }
  try {
    const res = await fetch(API_BASE + "/login", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      setToken(data.token);
      loginMsg.textContent = "Logged in";
    } else {
      loginMsg.textContent = data.message || "Login failed";
    }
  } catch (err) {
    loginMsg.textContent = "Server error";
  }
}

// Add item (admin)
async function addItem() {
  const name = document.getElementById("itemName").value.trim();
  const price = Number(document.getElementById("itemPrice").value || 0);
  const floor = Number(document.getElementById("itemFloor").value || 1);
  const x = Number(document.getElementById("itemX").value);
  const y = Number(document.getElementById("itemY").value);

  if (!name || isNaN(x) || isNaN(y)) {
    addMsg.textContent = "Name and valid X,Y required";
    return;
  }

  try {
    const res = await fetch(API_BASE + "/items", {
      method: "POST",
      headers: {
        "Content-Type":"application/json",
        "Authorization": token ? `Bearer ${token}` : ""
      },
      body: JSON.stringify({ name, price, floor, location: { x, y } })
    });
    const data = await res.json();
    if (res.ok) {
      addMsg.textContent = "Item added";
      loadItems();
    } else {
      addMsg.textContent = data.message || "Error";
    }
  } catch (err) {
    addMsg.textContent = "Server error";
  }
}

// Map rendering
function renderMap() {
  mapEl.innerHTML = "";
  mapEl.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  for (let y=0; y<gridSize; y++) {
    for (let x=0; x<gridSize; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.x = x;
      cell.dataset.y = y;
      const itemHere = items.find(i => i.location.x === x && i.location.y === y);
      if (itemHere) {
        const dot = document.createElement("div");
        dot.className = "dot";
        dot.title = itemHere.name;
        cell.appendChild(dot);
      }
      cell.onclick = () => {
        const cx = Number(cell.dataset.x);
        const cy = Number(cell.dataset.y);
        if (!start) {
          start = { x: cx, y: cy };
        } else if (!end) {
          end = { x: cx, y: cy };
          computePath();
        } else {
          // reset then set start
          start = { x: cx, y: cy };
          end = null;
          renderMap();
        }
        updateSelectionUI();
      };
      mapEl.appendChild(cell);
    }
  }
  updateSelectionUI();
}

// update UI to reflect start/end/path
function updateSelectionUI(path=[]) {
  // clear highlights
  document.querySelectorAll(".cell").forEach(c => {
    c.classList.remove("start","end","path");
  });

  if (start) {
    const sel = document.querySelector(`.cell[data-x="${start.x}"][data-y="${start.y}"]`);
    if (sel) sel.classList.add("start");
  }
  if (end) {
    const sel = document.querySelector(`.cell[data-x="${end.x}"][data-y="${end.y}"]`);
    if (sel) sel.classList.add("end");
  }
  for (const p of path) {
    const sel = document.querySelector(`.cell[data-x="${p.x}"][data-y="${p.y}"]`);
    if (sel) sel.classList.add("path");
  }
}

// compute path via backend
async function computePath() {
  if (!start || !end) return;
  try {
    const res = await fetch(API_BASE + "/path", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ start, end, gridSize })
    });
    const data = await res.json();
    if (data.shortestPath) {
      updateSelectionUI(data.shortestPath);
    } else {
      alert(data.message || "No path");
      updateSelectionUI();
    }
  } catch (err) {
    alert("Error computing path");
  }
}

function clearSelection() {
  start = null;
  end = null;
  renderMap();
}

// initial load
loadItems();
