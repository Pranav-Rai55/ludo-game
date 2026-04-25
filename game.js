// ============================================================
//  LUDO GAME — game.js
// ============================================================

// ── Constants ────────────────────────────────────────────────
const COLORS     = ['red', 'green', 'blue', 'yellow'];
const COLOR_HEX  = { red:'#E63946', green:'#2DC653', blue:'#3A86FF', yellow:'#FFD60A' };
const COLOR_NAME = { red:'RED',     green:'GREEN',   blue:'BLUE',    yellow:'YELLOW'  };

// Standard 52-step Ludo main path (col, row) on a 15×15 grid
const MAIN_PATH = [
  // Red start → going up left column
  [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],
  // Turn left → top-left zone
  [6,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
  // Down to row 7, then right
  [0,7],[0,6],
  // Green start → going right top zone
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,6],
  // Up to col 6, row 5 and higher
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  // Right to col 7, col 8
  [7,0],[8,0],
  // Blue start → going down right column
  [8,1],[8,2],[8,3],[8,4],[8,5],[8,6],
  // Right into bottom-right zone
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
  // Down to row 7, row 8
  [14,7],[14,8],
  // Yellow start → going left bottom zone
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,8],
  // Down into bottom column
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  // Back left toward red start
  [7,14],[7,13],
];

// Coloured safe home-column paths (6 steps → center)
const HOME_PATHS = {
  red:    [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  green:  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  blue:   [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
};

// Where on MAIN_PATH each colour enters
const START_IDX  = { red:0,  green:13, blue:26, yellow:39 };
// Last cell on MAIN_PATH before entering home column
const HOME_ENTRY = { red:50, green:11, blue:24, yellow:37 };

// Physical home-base squares in the coloured corners
const HOME_BASE = {
  red:    [[2,12],[3,12],[2,13],[3,13]],
  green:  [[2,2], [3,2], [2,3], [3,3] ],
  blue:   [[11,2],[12,2],[11,3],[12,3]],
  yellow: [[11,12],[12,12],[11,13],[12,13]],
};

// Indices on MAIN_PATH that are safe (star) squares
const SAFE_IDX = [8, 21, 34, 47, 1, 14, 27, 40];

// ── Game State ────────────────────────────────────────────────
let state = {};

function initState() {
  state = {
    currentPlayer : 0,
    diceValue     : 1,
    diceRolled    : false,
    gameOver      : false,
    sixCount      : 0,
    moveable      : [],
    tokens        : {},
  };

  COLORS.forEach(color => {
    state.tokens[color] = [0,1,2,3].map(id => ({
      id,
      color,
      pos      : -1,   // -1 = home base
      mainIdx  : -1,   // index in MAIN_PATH
      homeStep : -1,   // step in home column (0-5, 5 = home)
      finished : false,
    }));
  });
}

// ── Token coordinate lookup ───────────────────────────────────
function getCoords(token) {
  if (token.finished)       return [7, 7];
  if (token.pos === -1)     return HOME_BASE[token.color][token.id];
  if (token.homeStep >= 0)  return HOME_PATHS[token.color][token.homeStep];
  return MAIN_PATH[token.mainIdx % 52];
}

// ── Dice ──────────────────────────────────────────────────────
function rollDice() {
  if (state.diceRolled || state.gameOver) return;

  document.getElementById('btnRoll').disabled = true;
  const diceEl = document.getElementById('dice');
  diceEl.classList.add('rolling');

  let ticks = 0;
  const iv = setInterval(() => {
    renderDiceFace(Math.ceil(Math.random() * 6));
    ticks++;
    if (ticks >= 9) {
      clearInterval(iv);
      diceEl.classList.remove('rolling');
      const val = Math.ceil(Math.random() * 6);
      state.diceValue  = val;
      state.diceRolled = true;
      renderDiceFace(val);
      afterRoll(val);
    }
  }, 55);
}

function renderDiceFace(val) {
  // 3×3 dot layout for each face
  const PATTERNS = {
    1: [0,0,0, 0,1,0, 0,0,0],
    2: [1,0,0, 0,0,0, 0,0,1],
    3: [1,0,0, 0,1,0, 0,0,1],
    4: [1,0,1, 0,0,0, 1,0,1],
    5: [1,0,1, 0,1,0, 1,0,1],
    6: [1,0,1, 1,0,1, 1,0,1],
  };
  const diceEl = document.getElementById('dice');
  diceEl.innerHTML = '';
  PATTERNS[val].forEach(on => {
    const d = document.createElement('div');
    d.className = on ? 'dot' : 'dot hidden';
    diceEl.appendChild(d);
  });
}

// ── After Roll ────────────────────────────────────────────────
function afterRoll(val) {
  const color = COLORS[state.currentPlayer];
  log(`<span class="hl" style="color:${COLOR_HEX[color]}">${COLOR_NAME[color]}</span> rolled <span class="hl">${val}</span>`);

  state.moveable = findMoveable(color, val);

  if (state.moveable.length === 0) {
    log('No valid moves — skipping turn');
    setTimeout(() => nextTurn(val), 750);
    return;
  }

  if (state.moveable.length === 1) {
    setTimeout(() => moveToken(color, state.moveable[0], val), 350);
    return;
  }

  setStatus(`<span style="color:${COLOR_HEX[color]};font-weight:700">${COLOR_NAME[color]}</span> — click a token to move`);
  drawBoard();
}

// ── Find valid tokens ─────────────────────────────────────────
function findMoveable(color, val) {
  return state.tokens[color]
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => {
      if (t.finished) return false;
      if (t.pos === -1) return val === 6;
      if (t.homeStep >= 0) return t.homeStep + val <= 5;

      const dist = (HOME_ENTRY[color] - t.mainIdx + 52) % 52;
      if (val <= dist) return true;           // stays on main path
      return (val - dist - 1) <= 5;           // enters home column
    })
    .map(({ i }) => i);
}

// ── Move Token ────────────────────────────────────────────────
function moveToken(color, idx, val) {
  const token = state.tokens[color][idx];

  if (token.pos === -1) {
    // Leave home base on a 6
    token.pos     = 0;
    token.mainIdx = START_IDX[color];
    log(`<span class="hl" style="color:${COLOR_HEX[color]}">${COLOR_NAME[color]}</span> token ${idx+1} entered the board!`);

  } else if (token.homeStep >= 0) {
    // Move along home column
    token.homeStep += val;
    if (token.homeStep === 5) finishToken(token, color, idx);

  } else {
    // Move along main path
    const dist = (HOME_ENTRY[color] - token.mainIdx + 52) % 52;

    if (val <= dist) {
      token.mainIdx = (token.mainIdx + val) % 52;
      checkCapture(color, token);
    } else {
      const homeVal = val - dist - 1;
      token.mainIdx  = HOME_ENTRY[color];
      token.pos      = 1;
      token.homeStep = homeVal;
      if (homeVal === 5) finishToken(token, color, idx);
    }
  }

  state.moveable   = [];
  state.diceRolled = false;
  drawBoard();
  renderPlayerCards();
  nextTurn(val);
}

function finishToken(token, color, idx) {
  token.finished  = true;
  token.homeStep  = -1;
  log(`🎉 <span class="hl" style="color:${COLOR_HEX[color]}">${COLOR_NAME[color]}</span> token ${idx+1} reached HOME!`);
  if (state.tokens[color].every(t => t.finished)) {
    state.gameOver = true;
    setTimeout(() => showWinner(color), 700);
  }
}

// ── Capture ───────────────────────────────────────────────────
function checkCapture(attackColor, attacker) {
  const pos = attacker.mainIdx;
  if (SAFE_IDX.includes(pos)) return;

  COLORS.forEach(color => {
    if (color === attackColor) return;
    state.tokens[color].forEach(t => {
      if (t.pos === -1 || t.finished || t.homeStep >= 0) return;
      if (t.mainIdx === pos) {
        t.pos      = -1;
        t.mainIdx  = -1;
        log(`💥 <span class="hl" style="color:${COLOR_HEX[attackColor]}">${COLOR_NAME[attackColor]}</span> captured <span class="hl" style="color:${COLOR_HEX[color]}">${COLOR_NAME[color]}</span> token!`);
      }
    });
  });
}

// ── Turn Management ───────────────────────────────────────────
function nextTurn(val) {
  if (state.gameOver) return;

  if (val === 6) {
    state.sixCount++;
    if (state.sixCount >= 3) {
      log('Three 6s in a row — turn forfeited!');
      state.sixCount = 0;
      state.currentPlayer = (state.currentPlayer + 1) % 4;
    } else {
      log('Rolled 6 — roll again!');
    }
  } else {
    state.sixCount = 0;
    state.currentPlayer = (state.currentPlayer + 1) % 4;
  }

  state.diceRolled = false;
  document.getElementById('btnRoll').disabled = false;
  renderDiceFace(state.diceValue);
  renderPlayerCards();
  drawBoard();

  const c = COLORS[state.currentPlayer];
  setStatus(`<span style="color:${COLOR_HEX[c]};font-weight:700">${COLOR_NAME[c]}</span>'s turn — roll the dice!`);
}

// ── Winner ────────────────────────────────────────────────────
function showWinner(color) {
  document.getElementById('winnerTitle').textContent = `${COLOR_NAME[color]} WINS!`;
  document.getElementById('winnerTitle').style.color = COLOR_HEX[color];
  document.getElementById('winnerSub').textContent   = 'All tokens reached home — congratulations!';
  document.getElementById('winnerOverlay').classList.add('show');
}

// ── New Game ──────────────────────────────────────────────────
function newGame() {
  document.getElementById('winnerOverlay').classList.remove('show');
  document.getElementById('gameLog').innerHTML = '';
  initState();
  renderDiceFace(1);
  document.getElementById('btnRoll').disabled = false;
  setupCanvas();
  drawBoard();
  renderPlayerCards();
  const c = COLORS[state.currentPlayer];
  setStatus(`<span style="color:${COLOR_HEX[c]};font-weight:700">${COLOR_NAME[c]}</span>'s turn — roll the dice!`);
  log('🎮 New game started! RED goes first.');
}

// ── Canvas / Drawing ──────────────────────────────────────────
let CS = 40; // cell size in px

function setupCanvas() {
  const canvas = document.getElementById('board');
  const maxW   = Math.min(window.innerWidth - 300, 600);
  const maxH   = window.innerHeight - 160;
  const size   = Math.max(300, Math.min(maxW, maxH));
  CS = Math.floor(size / 15);
  canvas.width  = CS * 15;
  canvas.height = CS * 15;
}

function drawBoard() {
  const canvas = document.getElementById('board');
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dark background
  ctx.fillStyle = '#1e1c2e';
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 12);
  ctx.fill();

  drawColoredZones(ctx);
  drawMainPathCells(ctx);
  drawHomePaths(ctx);
  drawCenter(ctx);
  drawSafeStars(ctx);
  drawTokens(ctx);
}

// helper: rounded rect path
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function cellRect(col, row) {
  return { x: col*CS, y: row*CS, w: CS, h: CS };
}

function fillCell(ctx, col, row, color) {
  const { x, y, w, h } = cellRect(col, row);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function strokeCell(ctx, col, row, color, lw=0.5) {
  const { x, y, w, h } = cellRect(col, row);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.strokeRect(x, y, w, h);
}

function drawColoredZones(ctx) {
  const zones = [
    { color:'red',    c0:0,  r0:9,  c1:5,  r1:14 },
    { color:'green',  c0:0,  r0:0,  c1:5,  r1:5  },
    { color:'blue',   c0:9,  r0:0,  c1:14, r1:5  },
    { color:'yellow', c0:9,  r0:9,  c1:14, r1:14 },
  ];

  zones.forEach(z => {
    const x = z.c0*CS, y = z.r0*CS;
    const w = (z.c1 - z.c0 + 1)*CS, h = (z.r1 - z.r0 + 1)*CS;

    // Fill
    ctx.fillStyle = COLOR_HEX[z.color] + '25';
    ctx.fillRect(x, y, w, h);

    // Inner pad
    ctx.fillStyle = COLOR_HEX[z.color] + '40';
    ctx.fillRect(x + CS*0.6, y + CS*0.6, w - CS*1.2, h - CS*1.2);

    // Border
    ctx.strokeStyle = COLOR_HEX[z.color] + '99';
    ctx.lineWidth = 2;
    ctx.strokeRect(x+1, y+1, w-2, h-2);
  });
}

function drawMainPathCells(ctx) {
  MAIN_PATH.forEach(([c, r]) => {
    fillCell(ctx, c, r, 'rgba(255,255,255,0.04)');
    strokeCell(ctx, c, r, 'rgba(255,255,255,0.08)');
  });

  // Coloured start cells
  Object.entries(START_IDX).forEach(([color, idx]) => {
    const [c, r] = MAIN_PATH[idx];
    fillCell(ctx, c, r, COLOR_HEX[color] + '55');
  });
}

function drawHomePaths(ctx) {
  Object.entries(HOME_PATHS).forEach(([color, cells]) => {
    cells.forEach(([c, r]) => {
      fillCell(ctx, c, r, COLOR_HEX[color] + '55');
      strokeCell(ctx, c, r, COLOR_HEX[color] + '44');
    });
  });
}

function drawCenter(ctx) {
  const x = 6*CS, y = 6*CS, w = 3*CS, h = 3*CS;
  const cx = x + w/2, cy = y + h/2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Four coloured triangles
  const corners = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  ['blue','yellow','red','green'].forEach((color, i) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(...corners[i]);
    ctx.lineTo(...corners[(i+1)%4]);
    ctx.closePath();
    ctx.fillStyle = COLOR_HEX[color] + 'cc';
    ctx.fill();
  });

  // Dark circle
  ctx.beginPath();
  ctx.arc(cx, cy, CS * 0.62, 0, Math.PI*2);
  ctx.fillStyle = '#1e1c2e';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawSafeStars(ctx) {
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  SAFE_IDX.forEach(idx => {
    const [c, r] = MAIN_PATH[idx];
    fillCell(ctx, c, r, 'rgba(255,215,0,0.12)');
    ctx.font      = `${CS * 0.52}px serif`;
    ctx.fillStyle = 'rgba(255,215,0,0.65)';
    ctx.fillText('★', c*CS + CS/2, r*CS + CS/2);
  });
}

// ── Draw Tokens ───────────────────────────────────────────────
function drawTokens(ctx) {
  // Build a map of cell → list of tokens (for stacking offset)
  const cellMap = {};
  COLORS.forEach(color => {
    state.tokens[color].forEach(token => {
      const key = getCoords(token).join(',');
      if (!cellMap[key]) cellMap[key] = [];
      cellMap[key].push(token);
    });
  });

  COLORS.forEach(color => {
    state.tokens[color].forEach((token, idx) => {
      const [c, r]  = getCoords(token);
      const key     = `${c},${r}`;
      const group   = cellMap[key] || [token];
      const pos     = group.indexOf(token);
      const offsets = [[0,-0.18],[0.18,0],[-0.18,0],[0,0.18]];
      const off     = offsets[Math.min(pos, 3)] || [0,0];

      const cx = c*CS + CS/2 + off[0]*CS;
      const cy = r*CS + CS/2 + off[1]*CS;
      const tr = CS * 0.30;

      const isMoveable = state.moveable.includes(idx) && COLORS[state.currentPlayer] === color;

      // Glow for clickable tokens
      if (isMoveable) {
        ctx.beginPath();
        ctx.arc(cx, cy, tr * 1.8, 0, Math.PI*2);
        ctx.fillStyle = COLOR_HEX[color] + '33';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, tr * 1.45, 0, Math.PI*2);
        ctx.strokeStyle = COLOR_HEX[color];
        ctx.lineWidth   = 2;
        ctx.stroke();
      }

      // Shadow
      ctx.beginPath();
      ctx.arc(cx + 1, cy + 2, tr, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();

      // Gradient fill
      const g = ctx.createRadialGradient(cx - tr*0.3, cy - tr*0.3, 0, cx, cy, tr);
      g.addColorStop(0, lighten(COLOR_HEX[color], 50));
      g.addColorStop(1, COLOR_HEX[color]);
      ctx.beginPath();
      ctx.arc(cx, cy, tr, 0, Math.PI*2);
      ctx.fillStyle   = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Number label
      ctx.fillStyle    = 'rgba(255,255,255,0.92)';
      ctx.font         = `bold ${CS * 0.26}px "Space Mono", monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(token.finished ? '★' : idx + 1, cx, cy + 0.5);
    });
  });
}

function lighten(hex, amt) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + amt);
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + amt);
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + amt);
  return `rgb(${r},${g},${b})`;
}

// ── Canvas Click Handler ──────────────────────────────────────
document.getElementById('board').addEventListener('click', e => {
  if (!state.diceRolled || state.gameOver) return;
  const canvas = document.getElementById('board');
  const rect   = canvas.getBoundingClientRect();
  const clickC = Math.floor((e.clientX - rect.left)  / CS);
  const clickR = Math.floor((e.clientY - rect.top)   / CS);

  const color = COLORS[state.currentPlayer];
  state.tokens[color].forEach((token, idx) => {
    if (!state.moveable.includes(idx)) return;
    const [c, r] = getCoords(token);
    if (c === clickC && r === clickR) moveToken(color, idx, state.diceValue);
  });
});

// ── Player Cards ──────────────────────────────────────────────
function renderPlayerCards() {
  const container = document.getElementById('playerCards');
  container.innerHTML = '';

  COLORS.forEach((color, i) => {
    const isActive = state.currentPlayer === i && !state.gameOver;
    const tokens   = state.tokens[color];
    const finished = tokens.filter(t => t.finished).length;
    const onBoard  = tokens.filter(t => t.pos !== -1 && !t.finished).length;

    const card = document.createElement('div');
    card.className = 'player-card' + (isActive ? ' active' : '');
    card.style.setProperty('--accent-color', COLOR_HEX[color]);
    card.style.setProperty('--accent-glow',  COLOR_HEX[color] + '44');

    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-dot" style="background:${COLOR_HEX[color]}"></div>
        <div>
          <div class="player-name" style="color:${COLOR_HEX[color]}">${COLOR_NAME[color]}</div>
          <div class="player-status">${
            isActive   ? '▶ YOUR TURN' :
            finished===4 ? '🏆 WINNER'  :
            `${onBoard} on board · ${finished} home`
          }</div>
        </div>
      </div>
      <div class="tokens-display">
        ${tokens.map(t => `
          <div class="token-pip ${t.finished?'finished':''} ${t.pos===-1?'home':''}"
               style="background:${COLOR_HEX[color]}${t.pos===-1?'55':'cc'}">
            ${t.finished ? '★' : t.id + 1}
          </div>`).join('')}
      </div>`;

    container.appendChild(card);
  });
}

// ── UI Helpers ────────────────────────────────────────────────
function setStatus(html) {
  document.getElementById('statusBar').innerHTML = html;
}

function log(html) {
  const logEl = document.getElementById('gameLog');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = html;
  logEl.insertBefore(entry, logEl.firstChild);
  while (logEl.children.length > 22) logEl.removeChild(logEl.lastChild);
}

// ── Resize ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  setupCanvas();
  drawBoard();
});

// ── Boot ──────────────────────────────────────────────────────
newGame();
