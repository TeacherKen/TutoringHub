// Online 2 Player for TutoringHub: Mr Ken and the student each play one side on their own screen.
// The TutoringHub page around this game passes moves between the two screens; this file only
// talks to that page (window.parent, same site) and never to anyone else.
(function () {
  const parentWin = window.parent !== window ? window.parent : null;
  if (!parentWin) return;
  const origin = location.origin;
  const post = (msg) => parentWin.postMessage(Object.assign({ source: "wvs" }, msg), origin);
  let opponent = "your partner";
  let quiet = false;

  const compactMoves = () => gameState.moveHistory.map((m) => ({ pieceId: m.pieceId, to: m.to }));
  const report = () => post({ type: "state", moves: compactMoves(), winner: gameState.winner || null });

  if (/[?&]online=1/.test(location.search)) {
    // Straight into the game: no tutorial, no menu.
    tutorialOverlay.hidden = true;
  }

  /** Make one move for the other player, if it's allowed. */
  function applyMove(m) {
    const piece = m && getPiece(m.pieceId);
    if (!piece || piece.captured || piece.type !== gameState.currentTurn || gameState.winner) return false;
    const legal = getLegalMoves(piece.id).find((l) => l.targetNodeId === m.to);
    if (!legal) return false;
    executeMove(createMoveObject(piece, legal), "remote");
    return true;
  }

  /** A new online game as `side`, replaying `moves` so both screens show the same board. */
  function start(side, moves) {
    tutorialOverlay.hidden = true;
    quiet = true;
    const sound = playSound;
    playSound = function () {};
    try {
      initGame({ mode: "online", humanSide: side === "sheep" ? "sheep" : "wolf" });
      for (const m of moves || []) if (!applyMove(m)) break;
    } finally {
      playSound = sound;
      quiet = false;
    }
    gameState.animation = null;
    renderBoard();
    updateStatus();
    setFeedback(gameState.winner ? feedbackMessage.textContent : gameState.currentTurn === gameState.humanSide ? "Your turn." : `Waiting for ${opponent}…`);
    report();
    // Show the board straight away (it sits below the game's information panels).
    try {
      boardElement.scrollIntoView({ block: "center" });
    } catch (e) {
      /* fine */
    }
  }

  window.wvsAfterMove = function (move, actor) {
    if (gameState.mode !== "online" || quiet) return;
    if (actor === "human") {
      post({ type: "move", n: gameState.moveHistory.length, move: { pieceId: move.pieceId, to: move.to } });
      if (!gameState.winner) setFeedback(`Waiting for ${opponent}…`);
    }
    report();
  };
  window.wvsOnRestart = function () {
    start(gameState.humanSide, []);
    post({ type: "restart" });
  };
  window.wvsOnLeave = function () {
    post({ type: "left" });
  };

  window.addEventListener("message", (e) => {
    if (e.origin !== origin || e.source !== parentWin) return;
    const d = e.data || {};
    if (d.source !== "tutoringhub") return;
    if (d.opponent) opponent = String(d.opponent).slice(0, 30);
    if (d.type === "start") start(d.side, d.moves);
    else if (d.type === "sync" && gameState.mode === "online") start(gameState.humanSide, d.moves);
    else if (d.type === "restart" && gameState.mode === "online") start(gameState.humanSide, []);
    else if (d.type === "move" && gameState.mode === "online") {
      const have = gameState.moveHistory.length;
      if (d.n <= have) return; // already on the board
      if (d.n > have + 1 || !applyMove(d.move)) post({ type: "need-sync" });
    }
  });
  post({ type: "loaded" });
})();
