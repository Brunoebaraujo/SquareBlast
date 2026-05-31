"use strict";

const SIZE = 10;
const MIN_INITIAL_FILL = 20;
const MAX_INITIAL_FILL = 30;
const BEST_SCORE_KEY = "squareblast.bestScore";
const SCORE_TABLE = {
  1: 100,
  2: 220,
  3: 360,
  4: 520,
  5: 700,
  6: 900,
  7: 1120,
  8: 1360,
  9: 1620,
  10: 1900
};

const COLORS = [
  "#ff5c7a",
  "#ffb000",
  "#34c759",
  "#16c7d9",
  "#2f80ed",
  "#8b5cf6",
  "#ff7a1a",
  "#00a884",
  "#e84cff",
  "#f04438"
];

const SHAPES = [
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 1], [1, 1], [2, 1], [2, 0], [2, 2]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
  [[0, 1], [1, 0], [1, 1], [2, 1], [2, 2]]
];

const boardEl = document.getElementById("board");
const trayEl = document.getElementById("tray");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const modalEl = document.getElementById("game-over-modal");
const finalScoreEl = document.getElementById("final-score");
const modalBestScoreEl = document.getElementById("modal-best-score");
const ghostEl = document.getElementById("drag-ghost");

let state;
let dragState = null;

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function getBestScore() {
  return Number(localStorage.getItem(BEST_SCORE_KEY) || 0);
}

function setBestScore(score) {
  localStorage.setItem(BEST_SCORE_KEY, String(score));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalize(cells) {
  const minRow = Math.min(...cells.map(([row]) => row));
  const minCol = Math.min(...cells.map(([, col]) => col));
  return cells
    .map(([row, col]) => [row - minRow, col - minCol])
    .sort(([aRow, aCol], [bRow, bCol]) => aRow - bRow || aCol - bCol);
}

function rotate(cells) {
  return normalize(cells.map(([row, col]) => [col, -row]));
}

function transformShape(shape) {
  let cells = normalize(shape);
  const turns = randomInt(0, 3);
  for (let i = 0; i < turns; i += 1) {
    cells = rotate(cells);
  }
  if (Math.random() > 0.5) {
    const maxCol = Math.max(...cells.map(([, col]) => col));
    cells = normalize(cells.map(([row, col]) => [row, maxCol - col]));
  }
  return cells;
}

function getBounds(cells) {
  return {
    rows: Math.max(...cells.map(([row]) => row)) + 1,
    cols: Math.max(...cells.map(([, col]) => col)) + 1
  };
}

function isOrthogonallyConnected(cells) {
  if (cells.length < 4 || cells.length > 5) {
    return false;
  }

  const keys = new Set(cells.map(([row, col]) => `${row}-${col}`));
  const queue = [cells[0]];
  const seen = new Set([`${cells[0][0]}-${cells[0][1]}`]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queue.length) {
    const [row, col] = queue.shift();
    directions.forEach(([rowStep, colStep]) => {
      const key = `${row + rowStep}-${col + colStep}`;
      if (keys.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push([row + rowStep, col + colStep]);
      }
    });
  }

  return seen.size === cells.length;
}

function generatePieces() {
  const colors = shuffle(COLORS);
  const validShapes = SHAPES.filter(isOrthogonallyConnected);
  return Array.from({ length: 3 }, (_, index) => {
    const cells = transformShape(validShapes[randomInt(0, validShapes.length - 1)]);
    return {
      id: globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      cells,
      color: colors[index],
      ...getBounds(cells)
    };
  });
}

function generateInitialBoard(pieces) {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const board = emptyBoard();
    const fillCount = randomInt(MIN_INITIAL_FILL, MAX_INITIAL_FILL);
    const spots = shuffle(Array.from({ length: SIZE * SIZE }, (_, index) => index));
    for (let i = 0; i < fillCount; i += 1) {
      const row = Math.floor(spots[i] / SIZE);
      const col = spots[i] % SIZE;
      board[row][col] = COLORS[randomInt(0, COLORS.length - 1)];
    }
    if (pieces.every((piece) => canPlaceAnywhere(board, piece))) {
      return board;
    }
  }
  return generateReservedInitialBoard(pieces);
}

function generateReservedInitialBoard(pieces) {
  const board = emptyBoard();
  const reserved = new Set();

  pieces.forEach((piece) => {
    const maxRow = SIZE - piece.rows;
    const maxCol = SIZE - piece.cols;
    const row = randomInt(0, maxRow);
    const col = randomInt(0, maxCol);
    piece.cells.forEach(([rowOffset, colOffset]) => {
      reserved.add(`${row + rowOffset}-${col + colOffset}`);
    });
  });

  const fillCount = randomInt(MIN_INITIAL_FILL, MAX_INITIAL_FILL);
  const available = shuffle(Array.from({ length: SIZE * SIZE }, (_, index) => index)
    .filter((index) => !reserved.has(`${Math.floor(index / SIZE)}-${index % SIZE}`)));

  for (let i = 0; i < fillCount; i += 1) {
    const row = Math.floor(available[i] / SIZE);
    const col = available[i] % SIZE;
    board[row][col] = COLORS[randomInt(0, COLORS.length - 1)];
  }

  return board;
}

function canPlace(board, piece, startRow, startCol) {
  return piece.cells.every(([rowOffset, colOffset]) => {
    const row = startRow + rowOffset;
    const col = startCol + colOffset;
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE && !board[row][col];
  });
}

function canPlaceAnywhere(board, piece) {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (canPlace(board, piece, row, col)) {
        return true;
      }
    }
  }
  return false;
}

function placePiece(board, piece, startRow, startCol) {
  piece.cells.forEach(([rowOffset, colOffset]) => {
    board[startRow + rowOffset][startCol + colOffset] = piece.color;
  });
}

function findCompletedLines(board) {
  const rows = [];
  const cols = [];
  for (let row = 0; row < SIZE; row += 1) {
    if (board[row].every(Boolean)) {
      rows.push(row);
    }
  }
  for (let col = 0; col < SIZE; col += 1) {
    if (board.every((line) => line[col])) {
      cols.push(col);
    }
  }
  return { rows, cols };
}

function clearCompletedLines(board) {
  const { rows, cols } = findCompletedLines(board);
  const cleared = rows.length + cols.length;
  if (!cleared) {
    return 0;
  }
  const cellsToClear = new Set();
  rows.forEach((row) => {
    for (let col = 0; col < SIZE; col += 1) {
      cellsToClear.add(`${row}-${col}`);
    }
  });
  cols.forEach((col) => {
    for (let row = 0; row < SIZE; row += 1) {
      cellsToClear.add(`${row}-${col}`);
    }
  });
  cellsToClear.forEach((key) => {
    const [row, col] = key.split("-").map(Number);
    board[row][col] = null;
  });
  animateClearedCells(cellsToClear);
  return SCORE_TABLE[cleared] || 0;
}

function updateScore(points) {
  state.score += points;
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    setBestScore(state.bestScore);
  }
}

function newGame() {
  const pieces = generatePieces();
  state = {
    board: generateInitialBoard(pieces),
    pieces,
    score: 0,
    bestScore: getBestScore(),
    gameOver: false
  };
  closeModal();
  render();
}

function restartGame() {
  newGame();
}

function refillPiecesIfNeeded() {
  if (state.pieces.every((piece) => !piece)) {
    state.pieces = generatePieces();
  }
}

function checkGameOver() {
  const remaining = state.pieces.filter(Boolean);
  if (remaining.length && !remaining.some((piece) => canPlaceAnywhere(state.board, piece))) {
    state.gameOver = true;
    openModal();
  }
}

function render() {
  renderBoard();
  renderTray();
  scoreEl.textContent = state.score;
  bestScoreEl.textContent = state.bestScore;
}

function renderBoard(preview = null) {
  const previewCells = new Map();
  if (preview) {
    preview.piece.cells.forEach(([rowOffset, colOffset]) => {
      previewCells.set(`${preview.row + rowOffset}-${preview.col + colOffset}`, preview.valid);
    });
  }

  boardEl.innerHTML = "";
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement("div");
      const color = state.board[row][col];
      const previewState = previewCells.get(`${row}-${col}`);
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      if (color) {
        cell.classList.add("filled");
        cell.style.backgroundColor = color;
      }
      if (previewState === true) {
        cell.classList.add("preview-valid");
      } else if (previewState === false) {
        cell.classList.add("preview-invalid");
      }
      boardEl.appendChild(cell);
    }
  }
}

function renderTray() {
  trayEl.innerHTML = "";
  state.pieces.forEach((piece, index) => {
    const slot = document.createElement("div");
    slot.className = `piece-slot${piece ? "" : " empty"}`;
    if (piece) {
      const pieceEl = buildPieceElement(piece, "piece");
      pieceEl.dataset.index = index;
      pieceEl.addEventListener("pointerdown", startDrag);
      slot.appendChild(pieceEl);
    }
    trayEl.appendChild(slot);
  });
}

function buildPieceElement(piece, className) {
  const el = document.createElement("div");
  el.className = className;
  el.style.gridTemplateColumns = `repeat(${piece.cols}, var(--tray-cell))`;
  el.style.gridTemplateRows = `repeat(${piece.rows}, var(--tray-cell))`;
  const occupied = new Set(piece.cells.map(([row, col]) => `${row}-${col}`));
  for (let row = 0; row < piece.rows; row += 1) {
    for (let col = 0; col < piece.cols; col += 1) {
      const cell = document.createElement("div");
      cell.className = className === "piece" ? "piece-cell" : "ghost-cell";
      if (occupied.has(`${row}-${col}`)) {
        cell.style.backgroundColor = piece.color;
      } else {
        cell.classList.add("blank");
      }
      el.appendChild(cell);
    }
  }
  return el;
}

function startDrag(event) {
  if (state.gameOver) {
    return;
  }
  const index = Number(event.currentTarget.dataset.index);
  const piece = state.pieces[index];
  if (!piece) {
    return;
  }
  event.currentTarget.setPointerCapture(event.pointerId);
  const rect = event.currentTarget.getBoundingClientRect();
  dragState = {
    index,
    piece: clonePiece(piece),
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    pointerId: event.pointerId,
    candidate: null
  };
  ghostEl.innerHTML = "";
  ghostEl.appendChild(buildPieceElement(dragState.piece, "ghost"));
  ghostEl.className = "drag-ghost visible";
  moveDrag(event);
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", cancelDrag);
}

function clonePiece(piece) {
  return {
    ...piece,
    cells: piece.cells.map(([row, col]) => [row, col])
  };
}

function moveDrag(event) {
  if (!dragState) {
    return;
  }
  event.preventDefault();
  const x = event.clientX - dragState.offsetX;
  const y = event.clientY - dragState.offsetY;
  ghostEl.style.transform = `translate(${x}px, ${y}px)`;

  const candidate = getBoardCandidate(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY);
  dragState.candidate = candidate;
  clearPreviewClasses();

  if (!candidate) {
    ghostEl.classList.add("invalid");
    return;
  }
  const valid = canPlace(state.board, dragState.piece, candidate.row, candidate.col);
  ghostEl.classList.toggle("invalid", !valid);
  renderBoard({ piece: dragState.piece, row: candidate.row, col: candidate.col, valid });
}

function getBoardCandidate(pieceLeft, pieceTop) {
  const boardRect = boardEl.getBoundingClientRect();
  const styles = getComputedStyle(document.documentElement);
  const cellSize = Number.parseFloat(styles.getPropertyValue("--cell-size"));
  const gap = Number.parseFloat(styles.getPropertyValue("--grid-gap"));
  const stride = cellSize + gap;
  const col = Math.round((pieceLeft - boardRect.left - gap) / stride);
  const row = Math.round((pieceTop - boardRect.top - gap) / stride);
  if (row < -6 || row > SIZE || col < -6 || col > SIZE) {
    return null;
  }
  return { row, col };
}

function clearPreviewClasses() {
  if (!dragState || !dragState.candidate) {
    renderBoard();
  }
}

function endDrag(event) {
  if (!dragState) {
    return;
  }
  const { candidate, piece, index } = dragState;
  if (candidate && canPlace(state.board, piece, candidate.row, candidate.col)) {
    placePiece(state.board, piece, candidate.row, candidate.col);
    state.pieces[index] = null;
    const points = clearCompletedLines(state.board);
    updateScore(points);
    refillPiecesIfNeeded();
    render();
    checkGameOver();
  } else {
    render();
  }
  cleanupDrag(event);
}

function cancelDrag(event) {
  render();
  cleanupDrag(event);
}

function cleanupDrag() {
  dragState = null;
  ghostEl.className = "drag-ghost";
  ghostEl.innerHTML = "";
  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", cancelDrag);
}

function animateClearedCells(cellsToClear) {
  requestAnimationFrame(() => {
    [...boardEl.children].forEach((cell, index) => {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      if (cellsToClear.has(`${row}-${col}`)) {
        cell.classList.add("clearing");
      }
    });
  });
}

function openModal() {
  finalScoreEl.textContent = state.score;
  modalBestScoreEl.textContent = state.bestScore;
  modalEl.classList.add("open");
  modalEl.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modalEl.classList.remove("open");
  modalEl.setAttribute("aria-hidden", "true");
}

document.getElementById("new-game").addEventListener("click", newGame);
document.getElementById("restart").addEventListener("click", restartGame);
document.getElementById("modal-restart").addEventListener("click", restartGame);

newGame();
