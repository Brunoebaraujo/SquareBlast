"use strict";

const SIZE = 10;
const MIN_INITIAL_FILL = 10;
const MAX_INITIAL_FILL = 15;
const CLEAR_ANIMATION_MS = 220;
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
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 1], [1, 0], [1, 1]],
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

const PIECE_SIZE_WEIGHTS = [
  { size: 3, weight: 40 },
  { size: 4, weight: 40 },
  { size: 5, weight: 20 }
];
const TOUCH_LISTENER_OPTIONS = { passive: false };
const POINTER_LISTENER_OPTIONS = { passive: false };

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
let activeDraggedPiece = null;

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
  if (cells.length < 3 || cells.length > 5) {
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

function pickPieceSize() {
  const totalWeight = PIECE_SIZE_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
  let roll = randomInt(1, totalWeight);
  for (const item of PIECE_SIZE_WEIGHTS) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.size;
    }
  }
  return PIECE_SIZE_WEIGHTS[0].size;
}

function generatePieces() {
  const colors = shuffle(COLORS);
  const validShapes = SHAPES.filter(isOrthogonallyConnected);
  return Array.from({ length: 3 }, (_, index) => {
    const size = pickPieceSize();
    const sizeShapes = validShapes.filter((shape) => shape.length === size);
    const cells = transformShape(sizeShapes[randomInt(0, sizeShapes.length - 1)]);
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

function isValidPlacement(piece, startRow, startCol) {
  return canPlace(state.board, piece, startRow, startCol);
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

function getCompletedClearResult(board) {
  const { rows, cols } = findCompletedLines(board);
  const cleared = rows.length + cols.length;
  if (!cleared) {
    return { points: 0, cellsToClear: new Set() };
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
  return { points: SCORE_TABLE[cleared] || 0, cellsToClear };
}

function clearCellsFromBoard(cellsToClear) {
  cellsToClear.forEach((key) => {
    const [row, col] = key.split("-").map(Number);
    state.board[row][col] = null;
  });
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
    gameOver: false,
    isClearing: false
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

function finishTurn() {
  refillPiecesIfNeeded();
  render();
  state.isClearing = false;
  checkGameOver();
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
      if (window.PointerEvent) {
        pieceEl.addEventListener("pointerdown", startDrag, POINTER_LISTENER_OPTIONS);
      } else {
        pieceEl.addEventListener("touchstart", startDrag, TOUCH_LISTENER_OPTIONS);
        pieceEl.addEventListener("mousedown", startDrag);
      }
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
      cell.className = className.includes("piece") ? "piece-cell" : "ghost-cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
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
  if (state.gameOver || state.isClearing) {
    return;
  }
  const point = getClientPoint(event);
  if (!point) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  const index = Number(event.currentTarget.dataset.index);
  const piece = state.pieces[index];
  if (!piece) {
    return;
  }
  if (event.pointerId !== undefined && event.currentTarget.setPointerCapture) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (error) {
      // Some iOS WebViews expose Pointer Events without reliable pointer capture.
    }
  }
  const rect = event.currentTarget.getBoundingClientRect();
  activeDraggedPiece = clonePiece(piece);
  dragState = {
    index,
    piece: activeDraggedPiece,
    inputType: event.type.startsWith("touch") ? "touch" : event.type.startsWith("mouse") ? "mouse" : "pointer",
    offsetX: point.x - rect.left,
    offsetY: point.y - rect.top,
    pointerId: event.pointerId,
    dragAnchor: getDragAnchor(activeDraggedPiece, event.currentTarget, event.target, point),
    candidate: null
  };
  ghostEl.innerHTML = "";
  ghostEl.appendChild(buildPieceElement(activeDraggedPiece, "piece drag-piece"));
  ghostEl.className = "drag-ghost visible";
  moveDrag(event);
  addDragListeners();
}

function clonePiece(piece) {
  return {
    ...piece,
    cells: piece.cells.map(([row, col]) => [row, col])
  };
}

function getClientPoint(event) {
  if (event.changedTouches && event.changedTouches.length > 0) {
    return {
      x: event.changedTouches[0].clientX,
      y: event.changedTouches[0].clientY
    };
  }

  if (event.touches && event.touches.length > 0) {
    return {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
  }

  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }

  return null;
}

function getDragAnchor(piece, pieceEl, eventTarget, point) {
  const touchedCell = eventTarget.closest ? eventTarget.closest(".piece-cell") : null;
  if (touchedCell && pieceEl.contains(touchedCell) && !touchedCell.classList.contains("blank")) {
    return {
      row: Number(touchedCell.dataset.row),
      col: Number(touchedCell.dataset.col)
    };
  }

  const occupiedCells = [...pieceEl.querySelectorAll(".piece-cell:not(.blank)")];
  let nearest = { row: piece.cells[0][0], col: piece.cells[0][1] };
  let nearestDistance = Number.POSITIVE_INFINITY;

  occupiedCells.forEach((cell) => {
    const rect = cell.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = (point.x - centerX) ** 2 + (point.y - centerY) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = {
        row: Number(cell.dataset.row),
        col: Number(cell.dataset.col)
      };
    }
  });

  return nearest;
}

function addDragListeners() {
  if (dragState.inputType === "touch") {
    window.addEventListener("touchmove", moveDrag, TOUCH_LISTENER_OPTIONS);
    window.addEventListener("touchend", endDrag, TOUCH_LISTENER_OPTIONS);
    window.addEventListener("touchcancel", cancelDrag, TOUCH_LISTENER_OPTIONS);
    return;
  }
  if (dragState.inputType === "mouse") {
    window.addEventListener("mousemove", moveDrag);
    window.addEventListener("mouseup", endDrag);
    return;
  }
  window.addEventListener("pointermove", moveDrag, POINTER_LISTENER_OPTIONS);
  window.addEventListener("pointerup", endDrag, POINTER_LISTENER_OPTIONS);
  window.addEventListener("pointercancel", cancelDrag, POINTER_LISTENER_OPTIONS);
}

function removeDragListeners() {
  window.removeEventListener("touchmove", moveDrag, TOUCH_LISTENER_OPTIONS);
  window.removeEventListener("touchend", endDrag, TOUCH_LISTENER_OPTIONS);
  window.removeEventListener("touchcancel", cancelDrag, TOUCH_LISTENER_OPTIONS);
  window.removeEventListener("mousemove", moveDrag);
  window.removeEventListener("mouseup", endDrag);
  window.removeEventListener("pointermove", moveDrag, POINTER_LISTENER_OPTIONS);
  window.removeEventListener("pointerup", endDrag, POINTER_LISTENER_OPTIONS);
  window.removeEventListener("pointercancel", cancelDrag, POINTER_LISTENER_OPTIONS);
}

function getBoardDropTarget(point, shouldLog = false) {
  const rect = boardEl.getBoundingClientRect();
  const cellSize = rect.width / SIZE;
  const col = Math.floor((point.x - rect.left) / cellSize);
  const row = Math.floor((point.y - rect.top) / cellSize);
  const dragAnchor = dragState.dragAnchor;
  const targetRow = row - dragAnchor.row;
  const targetCol = col - dragAnchor.col;
  const withinBoard = row >= 0 && row < SIZE && col >= 0 && col < SIZE;
  const valid = withinBoard && isValidPlacement(activeDraggedPiece, targetRow, targetCol);

  if (shouldLog) {
    console.log("DROP POINT", point);
    console.log("BOARD RECT", rect);
    console.log("RAW CELL", row, col);
    console.log("ANCHOR", dragAnchor);
    console.log("TARGET", targetRow, targetCol);
    console.log("VALID", valid);
  }

  if (!withinBoard) {
    return null;
  }
  return { row: targetRow, col: targetCol, valid };
}

function moveDrag(event) {
  if (!dragState) {
    return;
  }
  const point = getClientPoint(event);
  if (!point) {
    return;
  }
  if (event.cancelable) {
    event.preventDefault();
  }
  const x = point.x - dragState.offsetX;
  const y = point.y - dragState.offsetY;
  ghostEl.style.transform = `translate(${x}px, ${y}px)`;

  const candidate = getBoardDropTarget(point);
  dragState.candidate = candidate;

  if (!candidate) {
    ghostEl.classList.add("invalid");
    renderBoard();
    return;
  }
  ghostEl.classList.toggle("invalid", !candidate.valid);
  renderBoard({ piece: dragState.piece, row: candidate.row, col: candidate.col, valid: candidate.valid });
}

async function endDrag(event) {
  if (!dragState) {
    return;
  }
  const point = getClientPoint(event);
  if (event.cancelable) {
    event.preventDefault();
  }
  const candidate = point ? getBoardDropTarget(point, true) : null;
  const { piece, index } = dragState;
  if (candidate && candidate.valid) {
    placePiece(state.board, piece, candidate.row, candidate.col);
    state.pieces[index] = null;
    const { points, cellsToClear } = getCompletedClearResult(state.board);
    updateScore(points);
    cleanupDrag();
    render();
    if (cellsToClear.size) {
      state.isClearing = true;
      await animateAndClearCells(cellsToClear);
    }
    finishTurn();
    return;
  }
  render();
  cleanupDrag();
}

function cancelDrag(event) {
  if (event.cancelable) {
    event.preventDefault();
  }
  render();
  cleanupDrag();
}

function cleanupDrag() {
  dragState = null;
  activeDraggedPiece = null;
  ghostEl.className = "drag-ghost";
  ghostEl.innerHTML = "";
  removeDragListeners();
}

function animateAndClearCells(cellsToClear) {
  state.isClearing = true;
  requestAnimationFrame(() => {
    [...boardEl.children].forEach((cell, index) => {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      if (cellsToClear.has(`${row}-${col}`)) {
        cell.classList.add("clearing");
      }
    });
  });

  return new Promise((resolve) => {
    window.setTimeout(() => {
      clearCellsFromBoard(cellsToClear);
      renderBoard();
      resolve();
    }, CLEAR_ANIMATION_MS);
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
