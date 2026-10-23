/*
 * Tile Drop: a falling-blocks arcade game for the Play tab.
 *
 * The rules (pieces, moves, line clears, scoring) are plain functions
 * so they can be tested on their own. Everyone gets the same pieces in
 * the same order on a given day, so the daily leaderboard is fair.
 */
(function (root) {
  "use strict";

  const COLS = 10;
  const ROWS = 20;

  // Colors from the app's tiles logo and card colors.
  const COLORS = [
    "#10b981", // I
    "#f59e0b", // O
    "#7c3aed", // T
    "#2563eb", // J
    "#e66767", // L
    "#14b8a6", // S
    "#d55181"  // Z
  ];

  const SHAPES = [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[1, 1], [1, 1]],
    [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
  ];

  const LINE_POINTS = [0, 100, 300, 500, 800];


  // Small seeded random numbers (same seed, same sequence).
  function seededRandom(seed) {
    let a = seed >>> 0;

    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }


  function seedFromText(text) {
    let hash = 2166136261;

    for (const char of String(text)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }


  // Pieces come in shuffled bags of all seven, so droughts are short.
  function pieceSequence(seedText) {
    const random =
      seededRandom(seedFromText(seedText));

    let bag = [];

    return () => {
      if (!bag.length) {
        bag = [0, 1, 2, 3, 4, 5, 6];

        for (let i = bag.length - 1; i > 0; i -= 1) {
          const j = Math.floor(random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }

      return bag.shift();
    };
  }


  function emptyBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }


  function rotate(shape) {
    const size = shape.length;

    return shape.map((row, y) =>
      row.map((_, x) => shape[size - 1 - x][y])
    );
  }


  function newPiece(type) {
    const shape =
      SHAPES[type].map(row => row.slice());

    return {
      type,
      shape,
      x: Math.floor((COLS - shape[0].length) / 2),
      y: type === 0 ? -1 : 0
    };
  }


  function fits(board, piece, dx = 0, dy = 0, shape = piece.shape) {
    for (let y = 0; y < shape.length; y += 1) {
      for (let x = 0; x < shape[y].length; x += 1) {
        if (!shape[y][x]) {
          continue;
        }

        const bx = piece.x + x + dx;
        const by = piece.y + y + dy;

        if (bx < 0 || bx >= COLS || by >= ROWS) {
          return false;
        }

        if (by >= 0 && board[by][bx]) {
          return false;
        }
      }
    }

    return true;
  }


  // Rotate clockwise, nudging sideways (or up) if it would overlap.
  function tryRotate(board, piece) {
    const shape =
      rotate(piece.shape);

    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
      if (fits(board, piece, dx, dy, shape)) {
        return { ...piece, shape, x: piece.x + dx, y: piece.y + dy };
      }
    }

    return piece;
  }


  // Stamp the piece into the board. Returns false if any of it is
  // still above the top (the stack reached the ceiling).
  function lock(board, piece) {
    let inside = true;

    piece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (!cell) {
          return;
        }

        const by = piece.y + y;

        if (by < 0) {
          inside = false;
        } else {
          board[by][piece.x + x] = piece.type + 1;
        }
      });
    });

    return inside;
  }


  function clearLines(board) {
    let cleared = 0;

    for (let y = ROWS - 1; y >= 0; y -= 1) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared += 1;
        y += 1;
      }
    }

    return cleared;
  }


  function levelFor(lines) {
    return Math.floor(lines / 10) + 1;
  }


  function pointsFor(cleared, level) {
    return LINE_POINTS[cleared] * level;
  }


  function dropDistance(board, piece) {
    let distance = 0;

    while (fits(board, piece, 0, distance + 1)) {
      distance += 1;
    }

    return distance;
  }


  // Milliseconds between automatic drops at a level: about 15%
  // faster each level, topping out around level 15.
  function gravityFor(level) {
    return Math.max(80, Math.round(700 * 0.85 ** (level - 1)));
  }


  /*
   * A game in progress: state plus the moves a player can make.
   * Draws to a canvas when given one.
   */
  function createGame({ seed, canvas, nextCanvas, onChange, onGameOver, onLand }) {
    const next =
      pieceSequence(seed);

    const state = {
      board: emptyBoard(),
      piece: null,
      nextType: next(),
      score: 0,
      lines: 0,
      level: 1,
      over: false,
      paused: false
    };

    let timer = null;

    function spawn() {
      state.piece = newPiece(state.nextType);
      state.nextType = next();

      if (!fits(state.board, state.piece)) {
        finish();
      }
    }

    function finish() {
      state.over = true;
      stop();
      draw();
      onGameOver && onGameOver({ score: state.score, lines: state.lines });
    }

    function settle() {
      if (!lock(state.board, state.piece)) {
        finish();
        return;
      }

      const cleared =
        clearLines(state.board);

      onLand && onLand({ cleared });

      if (cleared) {
        state.score += pointsFor(cleared, state.level);
        state.lines += cleared;

        const level =
          levelFor(state.lines);

        if (level !== state.level) {
          state.level = level;
          restartTimer();
        }
      }

      spawn();
    }

    function changed() {
      draw();
      onChange && onChange({ score: state.score, lines: state.lines, level: state.level });
    }

    const moves = {
      left() {
        if (fits(state.board, state.piece, -1, 0)) {
          state.piece.x -= 1;
        }
      },

      right() {
        if (fits(state.board, state.piece, 1, 0)) {
          state.piece.x += 1;
        }
      },

      rotate() {
        state.piece = tryRotate(state.board, state.piece);
      },

      down(byPlayer = true) {
        if (fits(state.board, state.piece, 0, 1)) {
          state.piece.y += 1;

          if (byPlayer) {
            state.score += 1;
          }
        } else {
          settle();
        }
      },

      drop() {
        const distance =
          dropDistance(state.board, state.piece);

        state.piece.y += distance;
        state.score += distance * 2;
        settle();
      }
    };

    function act(move) {
      if (state.over || state.paused || !state.piece) {
        return;
      }

      moves[move]();
      changed();
    }

    function tick() {
      if (state.over || state.paused) {
        return;
      }

      moves.down(false);
      changed();
    }

    function restartTimer() {
      stop();

      if (!state.over && !state.paused) {
        timer = setInterval(tick, gravityFor(state.level));
      }
    }

    function stop() {
      clearInterval(timer);
      timer = null;
    }

    function draw() {
      if (canvas) {
        drawBoard(canvas, state);
      }

      if (nextCanvas) {
        drawNext(nextCanvas, state.nextType);
      }
    }

    spawn();
    changed();
    restartTimer();

    return {
      state,
      act,
      pause() {
        state.paused = true;
        stop();
      },
      resume() {
        if (state.over) {
          return;
        }

        state.paused = false;
        restartTimer();
      },
      stop,
      draw
    };
  }


  function drawCell(ctx, x, y, size, color, ghost) {
    const pad =
      Math.max(1, size * 0.06);

    const r =
      size * 0.22;

    ctx.beginPath();

    if (ctx.roundRect) {
      ctx.roundRect(x + pad, y + pad, size - pad * 2, size - pad * 2, r);
    } else {
      ctx.rect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    }

    if (ghost) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = Math.max(1.5, size * 0.08);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
  }


  function fitCanvas(canvas) {
    const ratio =
      window.devicePixelRatio || 1;

    const width =
      canvas.clientWidth;

    const height =
      canvas.clientHeight;

    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }

    const ctx =
      canvas.getContext("2d");

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    return { ctx, width, height };
  }


  function drawBoard(canvas, state) {
    const { ctx, width, height } =
      fitCanvas(canvas);

    const size =
      Math.min(width / COLS, height / ROWS);

    const offsetX =
      (width - size * COLS) / 2;

    const style =
      getComputedStyle(canvas);

    ctx.fillStyle = style.getPropertyValue("--well").trim() || "rgba(255,255,255,0.04)";
    ctx.fillRect(offsetX, 0, size * COLS, size * ROWS);

    state.board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          drawCell(ctx, offsetX + x * size, y * size, size, COLORS[cell - 1]);
        }
      });
    });

    const piece =
      state.piece;

    if (!piece) {
      return;
    }

    const ghostY =
      piece.y + dropDistance(state.board, piece);

    piece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell && ghostY + y >= 0) {
          drawCell(ctx, offsetX + (piece.x + x) * size, (ghostY + y) * size, size, COLORS[piece.type], true);
        }
      });
    });

    piece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell && piece.y + y >= 0) {
          drawCell(ctx, offsetX + (piece.x + x) * size, (piece.y + y) * size, size, COLORS[piece.type]);
        }
      });
    });
  }


  function drawNext(canvas, type) {
    const { ctx, width, height } =
      fitCanvas(canvas);

    const shape =
      SHAPES[type];

    const cells =
      shape.flatMap((row, y) => row.map((cell, x) => cell ? [x, y] : null)).filter(Boolean);

    const minX = Math.min(...cells.map(c => c[0]));
    const maxX = Math.max(...cells.map(c => c[0]));
    const minY = Math.min(...cells.map(c => c[1]));
    const maxY = Math.max(...cells.map(c => c[1]));

    const size =
      Math.min(width / 4.5, height / 2.5);

    const offsetX =
      (width - (maxX - minX + 1) * size) / 2;

    const offsetY =
      (height - (maxY - minY + 1) * size) / 2;

    cells.forEach(([x, y]) => {
      drawCell(ctx, offsetX + (x - minX) * size, offsetY + (y - minY) * size, size, COLORS[type]);
    });
  }


  const api = {
    COLS,
    ROWS,
    createGame,
    rules: {
      seededRandom,
      seedFromText,
      pieceSequence,
      emptyBoard,
      rotate,
      newPiece,
      fits,
      tryRotate,
      lock,
      clearLines,
      levelFor,
      pointsFor,
      dropDistance,
      gravityFor
    }
  };

  root.TileDrop = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
