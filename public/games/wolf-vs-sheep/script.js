const boardElement = document.getElementById("board");
const startScreen = document.getElementById("startScreen");
const sideSelectionScreen = document.getElementById("sideSelectionScreen");
const difficultyScreen = document.getElementById("difficultyScreen");
const gameScreen = document.getElementById("gameScreen");
const localModeButton = document.getElementById("localModeButton");
const singlePlayerButton = document.getElementById("singlePlayerButton");
const playWolfButton = document.getElementById("playWolfButton");
const playSheepButton = document.getElementById("playSheepButton");
const sideBackButton = document.getElementById("sideBackButton");
const easyButton = document.getElementById("easyButton");
const normalButton = document.getElementById("normalButton");
const hardButton = document.getElementById("hardButton");
const difficultyBackButton = document.getElementById("difficultyBackButton");
const mainMenuButton = document.getElementById("mainMenuButton");
const turnLabel = document.getElementById("turnLabel");
const turnIcon = document.getElementById("turnIcon");
const turnHelper = document.getElementById("turnHelper");
const turnCard = document.getElementById("turnCard");
const modeLabel = document.getElementById("modeLabel");
const humanSideLabel = document.getElementById("humanSideLabel");
const difficultyLabel = document.getElementById("difficultyLabel");
const aiBanner = document.getElementById("aiBanner");
const capturedCount = document.getElementById("capturedCount");
const winnerMessage = document.getElementById("winnerMessage");
const feedbackMessage = document.getElementById("feedbackMessage");
const aiStatsCard = document.getElementById("aiStatsCard");
const lastAIMoveLabel = document.getElementById("lastAIMoveLabel");
const nodesEvaluatedLabel = document.getElementById("nodesEvaluatedLabel");
const searchDepthLabel = document.getElementById("searchDepthLabel");
const evaluationScoreLabel = document.getElementById("evaluationScoreLabel");
const currentAIMoveTimeLabel = document.getElementById("currentAIMoveTimeLabel");
const lifetimeAINodesLabel = document.getElementById("lifetimeAINodesLabel");
const lifetimeAIDepthLabel = document.getElementById("lifetimeAIDepthLabel");
const lifetimeAIMoveTimeLabel = document.getElementById("lifetimeAIMoveTimeLabel");
const totalMovesLabel = document.getElementById("totalMovesLabel");
const capturesLabel = document.getElementById("capturesLabel");
const matchLengthLabel = document.getElementById("matchLengthLabel");
const winnerStatLabel = document.getElementById("winnerStatLabel");
const wolfMobilityLabel = document.getElementById("wolfMobilityLabel");
const remainingSheepLabel = document.getElementById("remainingSheepLabel");
const balanceCapturedLabel = document.getElementById("balanceCapturedLabel");
const historyTotalMatchesLabel = document.getElementById("historyTotalMatchesLabel");
const historyWolfWinsLabel = document.getElementById("historyWolfWinsLabel");
const historySheepWinsLabel = document.getElementById("historySheepWinsLabel");
const historyWolfRateLabel = document.getElementById("historyWolfRateLabel");
const historySheepRateLabel = document.getElementById("historySheepRateLabel");
const averageMatchLengthLabel = document.getElementById("averageMatchLengthLabel");
const averageCapturesLabel = document.getElementById("averageCapturesLabel");
const difficultyStatsList = document.getElementById("difficultyStatsList");
const shortMatchRateLabel = document.getElementById("shortMatchRateLabel");
const mediumMatchRateLabel = document.getElementById("mediumMatchRateLabel");
const longMatchRateLabel = document.getElementById("longMatchRateLabel");
const commonOpeningLabel = document.getElementById("commonOpeningLabel");
const successfulOpeningLabel = document.getElementById("successfulOpeningLabel");
const balanceInsightsList = document.getElementById("balanceInsightsList");
const simulationStatusLabel = document.getElementById("simulationStatusLabel");
const simulate10Button = document.getElementById("simulate10Button");
const simulate50Button = document.getElementById("simulate50Button");
const simulate100Button = document.getElementById("simulate100Button");
const simulationWolfWinsLabel = document.getElementById("simulationWolfWinsLabel");
const simulationSheepWinsLabel = document.getElementById("simulationSheepWinsLabel");
const simulationAverageLengthLabel = document.getElementById("simulationAverageLengthLabel");
const simulationWolfRateLabel = document.getElementById("simulationWolfRateLabel");
const simulationRecommendationsList = document.getElementById("simulationRecommendationsList");
const moveHistoryList = document.getElementById("moveHistoryList");
const undoButton = document.getElementById("undoButton");
const exportButton = document.getElementById("exportButton");
const exportAnalyticsButton = document.getElementById("exportAnalyticsButton");
const replayButton = document.getElementById("replayButton");
const firstReplayButton = document.getElementById("firstReplayButton");
const previousReplayButton = document.getElementById("previousReplayButton");
const nextReplayButton = document.getElementById("nextReplayButton");
const lastReplayButton = document.getElementById("lastReplayButton");
const replayStatusLabel = document.getElementById("replayStatusLabel");
const debugToggle = document.getElementById("debugToggle");
const developerPanel = document.getElementById("developerPanel");
const forceWolfWinButton = document.getElementById("forceWolfWinButton");
const forceSheepWinButton = document.getElementById("forceSheepWinButton");
const addCaptureButton = document.getElementById("addCaptureButton");
const resetAnalyticsButton = document.getElementById("resetAnalyticsButton");
const generateTestMatchButton = document.getElementById("generateTestMatchButton");
const restartButton = document.getElementById("restartButton");
const soundToggleButton = document.getElementById("soundToggleButton");
const tutorialOverlay = document.getElementById("tutorialOverlay");
const tutorialStepLabel = document.getElementById("tutorialStepLabel");
const tutorialTitle = document.getElementById("tutorialTitle");
const tutorialText = document.getElementById("tutorialText");
const tutorialSkipButton = document.getElementById("tutorialSkipButton");
const tutorialNextButton = document.getElementById("tutorialNextButton");
const winOverlay = document.getElementById("winOverlay");
const winIcon = document.getElementById("winIcon");
const winTitle = document.getElementById("winTitle");
const winReason = document.getElementById("winReason");
const achievementToast = document.getElementById("achievementToast");
const playAgainButton = document.getElementById("playAgainButton");
const winMenuButton = document.getElementById("winMenuButton");
const watchReplayButton = document.getElementById("watchReplayButton");
const achievementList = document.getElementById("achievementList");

const BOARD_SIZE = 5;
const CAPTURES_TO_WIN = 7;
const AI_THINK_DELAY = 650;
const MINIMAX_NODE_LIMIT = 18000;
const MAX_HISTORY_MATCHES = 100;
const SIMULATION_MAX_TURNS = 180;
const DEFAULT_FEEDBACK = "Click one of your pieces, then click a highlighted spot to move.";
const STORAGE_KEYS = {
  soundMuted: "wolfSheep.soundMuted",
  tutorialSeen: "wolfSheep.tutorialSeen",
  preferredDifficulty: "wolfSheep.preferredDifficulty",
  achievements: "wolfSheep.achievements",
  gameHistory: "wolfSheep.gameHistory"
};
const TUTORIAL_STEPS = [
  {
    title: "Select a piece.",
    text: "Click one of your current side's tokens to see its legal moves."
  },
  {
    title: "Move to highlighted spaces.",
    text: "Green spots are normal moves. Red-orange spots are captures."
  },
  {
    title: "Capture or trap.",
    text: "The wolf captures sheep. The sheep win by blocking every wolf move."
  }
];
const ACHIEVEMENTS = [
  { id: "firstVictory", name: "First Victory" },
  { id: "wolfHunter", name: "Wolf Hunter" },
  { id: "predator", name: "Predator" },
  { id: "strategist", name: "Strategist" }
];

// The board is a graph. Coordinates are only used for layout and to find
// the landing node directly beyond a sheep during wolf captures.
const nodes = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  return {
    id: `n${index}`,
    row,
    col,
    x: 10 + col * 20,
    y: 10 + row * 20
  };
});

const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
const nodeByPosition = Object.fromEntries(nodes.map((node) => [`${node.row},${node.col}`, node]));

const edges = buildEdges();
const adjacency = buildAdjacency(edges);

const initialPieces = [
  { id: "wolf", type: "wolf", nodeId: "n22" },
  { id: "sheep1", type: "sheep", nodeId: "n1" },
  { id: "sheep2", type: "sheep", nodeId: "n2" },
  { id: "sheep3", type: "sheep", nodeId: "n3" },
  { id: "sheep4", type: "sheep", nodeId: "n5" },
  { id: "sheep5", type: "sheep", nodeId: "n6" },
  { id: "sheep6", type: "sheep", nodeId: "n7" },
  { id: "sheep7", type: "sheep", nodeId: "n8" },
  { id: "sheep8", type: "sheep", nodeId: "n9" },
  { id: "sheep9", type: "sheep", nodeId: "n11" },
  { id: "sheep10", type: "sheep", nodeId: "n12" },
  { id: "sheep11", type: "sheep", nodeId: "n13" },
  { id: "sheep12", type: "sheep", nodeId: "n14" }
];

let aiTurnSequence = 0;
let matchTimerId = null;
let animationTimerId = null;
let audioContext = null;
let tutorialStepIndex = 0;
const preferences = loadPreferences();
const unlockedAchievements = loadAchievements();
let gameHistory = loadGameHistory();
let isSimulationRunning = false;
let gameState = createInitialState();

function createInitialState(overrides = {}) {
  return {
    screen: "start",
    mode: null,
    humanSide: null,
    aiDifficulty: null,
    currentTurn: "wolf",
    selectedPieceId: null,
    legalMoves: [],
    capturedSheep: 0,
    winner: null,
    isAIThinking: false,
    aiTurnToken: aiTurnSequence,
    aiStats: {
      lastMove: "None",
      nodesEvaluated: 0,
      searchDepth: 0,
      evaluationScore: 0,
      lastMoveTimeMs: 0,
      totalNodesEvaluated: 0,
      totalSearchDepth: 0,
      totalMoveTimeMs: 0,
      aiMoveCount: 0
    },
    moveHistory: [],
    undoStack: [],
    turnNumber: 0,
    matchStartedAt: null,
    matchEndedAt: null,
    replay: createReplayState(),
    debugMode: false,
    animation: null,
    winOverlayShown: false,
    matchRecorded: false,
    feedbackMessage: DEFAULT_FEEDBACK,
    pieces: [],
    ...overrides
  };
}

function initGame(options = {}) {
  hideWinOverlay();
  const mode = options.mode || gameState.mode || "local";
  const humanSide = mode === "singleplayer" ? options.humanSide || gameState.humanSide || "wolf" : null;
  const aiDifficulty = mode === "singleplayer" ? options.aiDifficulty || gameState.aiDifficulty || preferences.preferredDifficulty || "normal" : null;
  const aiTurnToken = cancelPendingAITurn();

  gameState = createInitialState({
    screen: "game",
    mode,
    humanSide,
    aiDifficulty,
    currentTurn: "wolf",
    aiTurnToken,
    matchStartedAt: Date.now(),
    pieces: initialPieces.map((piece) => ({ ...piece, captured: false }))
  });

  showGameScreen();
  resetDebugUI();
  startMatchTimer();
  renderBoard();
  updateStatus();
  maybeHandleAITurn();
}

function showStartScreen() {
  hideWinOverlay();
  stopMatchTimer();
  gameState = createInitialState({
    screen: "start",
    aiTurnToken: cancelPendingAITurn()
  });
  setActiveScreen("start");
  resetDebugUI();
  boardElement.classList.remove("is-thinking");
  boardElement.innerHTML = "";
}

function showSideSelection() {
  hideWinOverlay();
  stopMatchTimer();
  gameState = createInitialState({
    screen: "side-selection",
    mode: "singleplayer",
    aiTurnToken: cancelPendingAITurn()
  });
  setActiveScreen("side-selection");
  resetDebugUI();
  boardElement.classList.remove("is-thinking");
}

function showDifficultySelection(humanSide) {
  hideWinOverlay();
  stopMatchTimer();
  gameState = createInitialState({
    screen: "difficulty",
    mode: "singleplayer",
    humanSide,
    aiTurnToken: cancelPendingAITurn()
  });
  setActiveScreen("difficulty");
  updatePreferredDifficultyButtons();
  resetDebugUI();
  boardElement.classList.remove("is-thinking");
}

function showGameScreen() {
  gameState.screen = "game";
  setActiveScreen("game");
}

function setActiveScreen(screenName) {
  startScreen.classList.toggle("is-active", screenName === "start");
  sideSelectionScreen.classList.toggle("is-active", screenName === "side-selection");
  difficultyScreen.classList.toggle("is-active", screenName === "difficulty");
  gameScreen.classList.toggle("is-active", screenName === "game");
}

function startLocalGame() {
  initGame({ mode: "local", humanSide: null });
}

function startSinglePlayerGame(aiDifficulty) {
  preferences.preferredDifficulty = aiDifficulty;
  savePreference(STORAGE_KEYS.preferredDifficulty, aiDifficulty);
  updatePreferredDifficultyButtons();
  initGame({
    mode: "singleplayer",
    humanSide: gameState.humanSide || "wolf",
    aiDifficulty
  });
}

function updatePreferredDifficultyButtons() {
  [
    ["easy", easyButton],
    ["normal", normalButton],
    ["hard", hardButton]
  ].forEach(([difficulty, button]) => {
    button.classList.toggle("preferred", preferences.preferredDifficulty === difficulty);
  });
}

function restartMatch() {
  if (!gameState.mode) {
    showStartScreen();
    return;
  }

  initGame({
    mode: gameState.mode,
    humanSide: gameState.humanSide,
    aiDifficulty: gameState.aiDifficulty
  });
}

function renderBoard() {
  boardElement.innerHTML = "";
  boardElement.classList.toggle("is-thinking", gameState.isAIThinking);
  boardElement.classList.toggle("is-replay", gameState.replay.active);
  const displayPieces = getDisplayPieces();

  edges.forEach(([fromId, toId]) => {
    boardElement.appendChild(createEdgeElement(nodeById[fromId], nodeById[toId]));
  });

  nodes.forEach((node) => {
    const nodeButton = document.createElement("button");
    const move = gameState.replay.active ? null : gameState.legalMoves.find((legalMove) => legalMove.targetNodeId === node.id);

    nodeButton.type = "button";
    nodeButton.className = "node";
    nodeButton.style.left = `${node.x}%`;
    nodeButton.style.top = `${node.y}%`;
    nodeButton.setAttribute("aria-label", `Board node ${node.id}, row ${node.row + 1}, column ${node.col + 1}`);

    if (gameState.debugMode) {
      nodeButton.classList.add("debug-node");
      nodeButton.textContent = node.id;
    }

    if (move) {
      nodeButton.classList.add(move.capturePieceId ? "capture" : "legal");
      nodeButton.addEventListener("click", () => movePiece(node.id));
    } else if (!gameState.replay.active) {
      nodeButton.addEventListener("click", () => handleInactiveNodeClick(node.id));
    }

    boardElement.appendChild(nodeButton);
  });

  displayPieces
    .filter((piece) => !piece.captured)
    .forEach((piece) => {
      const node = nodeById[piece.nodeId];
      const pieceButton = document.createElement("button");

      pieceButton.type = "button";
      pieceButton.className = `piece ${piece.type}`;
      pieceButton.style.left = `${node.x}%`;
      pieceButton.style.top = `${node.y}%`;
      pieceButton.textContent = getPieceDisplayText(piece);
      pieceButton.setAttribute("aria-label", `${piece.type} on ${piece.nodeId}`);

      if (!gameState.replay.active && gameState.animation?.move?.pieceId === piece.id) {
        const fromNode = nodeById[gameState.animation.move.from];
        pieceButton.classList.add("moving");
        pieceButton.classList.toggle("capture-jump", gameState.animation.move.type === "capture");
        pieceButton.style.left = `${fromNode.x}%`;
        pieceButton.style.top = `${fromNode.y}%`;
        requestAnimationFrameSafe(() => {
          pieceButton.style.left = `${node.x}%`;
          pieceButton.style.top = `${node.y}%`;
        });
      }

      if (gameState.debugMode) {
        pieceButton.classList.add("debug-piece");
        pieceButton.title = `${piece.type} mobility: ${getLegalMoves(piece.id).length}`;
      }

      if (!gameState.replay.active) {
        pieceButton.addEventListener("click", () => handlePieceClick(piece.id));
      }

      if (!gameState.replay.active && canHumanControlPiece(piece)) {
        pieceButton.classList.add("selectable");
      }

      if (piece.id === gameState.selectedPieceId) {
        pieceButton.classList.add("selected");
      }

      boardElement.appendChild(pieceButton);
    });

  if (!gameState.replay.active && gameState.animation?.capturedPiece) {
    boardElement.appendChild(createCapturedGhost(gameState.animation.capturedPiece));
  }
}

function getDisplayPieces() {
  return gameState.replay.active ? gameState.replay.pieces : gameState.pieces;
}

function getPieceDisplayText(piece) {
  if (!gameState.debugMode) {
    return getTurnIcon(piece.type);
  }

  return `${getTurnIcon(piece.type)} ${getLegalMoves(piece.id).length}`;
}

function createCapturedGhost(piece) {
  const node = nodeById[piece.nodeId];
  const ghost = document.createElement("div");

  ghost.className = `piece ${piece.type} captured-ghost`;
  ghost.style.left = `${node.x}%`;
  ghost.style.top = `${node.y}%`;
  ghost.textContent = getTurnIcon(piece.type);

  return ghost;
}

function handlePieceClick(pieceId) {
  const piece = getPiece(pieceId);

  if (gameState.winner) {
    setFeedback("Game over. Restart to play again.");
    return;
  }

  if (!piece || piece.captured) {
    return;
  }

  if (!canAcceptHumanInput()) {
    setFeedback(gameState.isAIThinking ? "AI is thinking..." : "Wait for your turn.");
    return;
  }

  if (gameState.mode === "singleplayer" && piece.type !== gameState.humanSide) {
    setFeedback(`You are playing as ${getTurnName(gameState.humanSide)}.`);
    return;
  }

  if (piece.type !== gameState.currentTurn) {
    setFeedback(`It is ${getTurnName(gameState.currentTurn)}'s turn.`);
    return;
  }

  selectPiece(pieceId);
}

function handleInactiveNodeClick() {
  if (gameState.winner) {
    setFeedback("Game over. Restart to play again.");
    return;
  }

  if (!canAcceptHumanInput()) {
    setFeedback(gameState.isAIThinking ? "AI is thinking..." : "Wait for your turn.");
    return;
  }

  if (gameState.selectedPieceId) {
    clearSelection("Selection cleared. Pick another piece or move.");
    return;
  }

  setFeedback(`Select a ${getTurnName(gameState.currentTurn)} piece first.`);
}

function createEdgeElement(fromNode, toNode) {
  const edge = document.createElement("div");
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  edge.className = "edge";
  edge.style.left = `${fromNode.x}%`;
  edge.style.top = `${fromNode.y}%`;
  edge.style.width = `${length}%`;
  edge.style.transform = `rotate(${angle}deg)`;

  return edge;
}

function selectPiece(pieceId) {
  const piece = getPiece(pieceId);

  if (gameState.winner || !piece || piece.captured || piece.type !== gameState.currentTurn || !canHumanControlPiece(piece)) {
    return;
  }

  gameState.selectedPieceId = pieceId;
  gameState.legalMoves = getLegalMoves(pieceId);
  updateSelectionFeedback(piece);
  renderBoard();
}

function getLegalMoves(pieceId) {
  const piece = getPiece(pieceId);

  if (!piece || piece.captured) {
    return [];
  }

  const oneStepMoves = adjacency[piece.nodeId]
    .filter((neighborId) => !getPieceAtNode(neighborId))
    .map((targetNodeId) => ({ targetNodeId, capturePieceId: null }));

  if (piece.type !== "wolf") {
    return oneStepMoves;
  }

  const captureMoves = adjacency[piece.nodeId]
    .map((neighborId) => getCaptureMove(piece, neighborId))
    .filter(Boolean);

  return [...oneStepMoves, ...captureMoves];
}

function getCaptureMove(wolf, sheepNodeId) {
  const sheep = getPieceAtNode(sheepNodeId);

  if (!sheep || sheep.type !== "sheep") {
    return null;
  }

  const wolfNode = nodeById[wolf.nodeId];
  const sheepNode = nodeById[sheepNodeId];
  const landingRow = sheepNode.row + (sheepNode.row - wolfNode.row);
  const landingCol = sheepNode.col + (sheepNode.col - wolfNode.col);
  const landingNode = nodeByPosition[`${landingRow},${landingCol}`];

  if (!landingNode || getPieceAtNode(landingNode.id)) {
    return null;
  }

  // A capture jump is legal only when both halves of the jump are graph edges.
  if (!areConnected(wolf.nodeId, sheepNode.id) || !areConnected(sheepNode.id, landingNode.id)) {
    return null;
  }

  return {
    targetNodeId: landingNode.id,
    capturePieceId: sheep.id
  };
}

function movePiece(targetNodeId) {
  if (!canAcceptHumanInput()) {
    setFeedback(gameState.isAIThinking ? "AI is thinking..." : "Wait for your turn.");
    return;
  }

  if (gameState.winner || !gameState.selectedPieceId) {
    setFeedback("Select a piece before moving.");
    return;
  }

  const move = gameState.legalMoves.find((legalMove) => legalMove.targetNodeId === targetNodeId);
  const piece = getPiece(gameState.selectedPieceId);

  if (!move || !piece) {
    setFeedback("That spot is not a legal move.");
    return;
  }

  executeMove(createMoveObject(piece, move), "human");
}

function executeMove(move, actor = "human") {
  const piece = getPiece(move.pieceId);

  if (!piece || piece.captured || gameState.winner) {
    return;
  }

  const undoSnapshot = createMatchSnapshot();
  const movingSide = piece.type;
  prepareMoveAnimation(move);

  piece.nodeId = move.to;

  if (move.capturedPieceId) {
    const capturedPiece = getPiece(move.capturedPieceId);

    if (capturedPiece) {
      capturedPiece.captured = true;
      gameState.capturedSheep += 1;
    }
  }

  recordMove(move, movingSide, actor, undoSnapshot);
  gameState.selectedPieceId = null;
  gameState.legalMoves = [];
  setMoveFeedback(move, actor);
  playSound(move.type === "capture" ? "capture" : "move");
  checkWinCondition();

  if (!gameState.winner) {
    switchTurn();
  }

  renderBoard();
  updateStatus();
  maybeHandleAITurn();
}

function prepareMoveAnimation(move) {
  window.clearTimeout(animationTimerId);
  const capturedPiece = move.capturedPieceId ? getPiece(move.capturedPieceId) : null;

  gameState.animation = {
    id: Date.now(),
    move: { ...move },
    capturedPiece: capturedPiece ? { ...capturedPiece } : null
  };

  animationTimerId = window.setTimeout(() => {
    gameState.animation = null;
    renderBoard();
  }, 320);
}

function createMoveObject(piece, legalMove) {
  return {
    pieceId: piece.id,
    from: piece.nodeId,
    to: legalMove.targetNodeId,
    type: legalMove.capturePieceId ? "capture" : "move",
    capturedPieceId: legalMove.capturePieceId || null
  };
}

function recordMove(move, side, actor, undoSnapshot) {
  const historyEntry = {
    turn: gameState.turnNumber + 1,
    pieceId: move.pieceId,
    side,
    from: move.from,
    to: move.to,
    type: move.type,
    actor
  };

  if (move.capturedPieceId) {
    historyEntry.capturedPieceId = move.capturedPieceId;
  }

  gameState.turnNumber += 1;
  gameState.moveHistory.push(historyEntry);

  if (gameState.mode === "local") {
    gameState.undoStack.push(undoSnapshot);
  }
}

function createMatchSnapshot() {
  return {
    pieces: gameState.pieces.map((piece) => ({ ...piece })),
    capturedSheep: gameState.capturedSheep,
    currentTurn: gameState.currentTurn,
    winner: gameState.winner,
    selectedPieceId: gameState.selectedPieceId,
    legalMoves: gameState.legalMoves.map((move) => ({ ...move })),
    feedbackMessage: gameState.feedbackMessage,
    moveHistory: gameState.moveHistory.map((move) => ({ ...move })),
    turnNumber: gameState.turnNumber,
    matchEndedAt: gameState.matchEndedAt,
    matchRecorded: gameState.matchRecorded
  };
}

function restoreMatchSnapshot(snapshot) {
  gameState.pieces = snapshot.pieces.map((piece) => ({ ...piece }));
  gameState.capturedSheep = snapshot.capturedSheep;
  gameState.currentTurn = snapshot.currentTurn;
  gameState.winner = snapshot.winner;
  gameState.selectedPieceId = snapshot.selectedPieceId;
  gameState.legalMoves = snapshot.legalMoves.map((move) => ({ ...move }));
  gameState.feedbackMessage = snapshot.feedbackMessage;
  gameState.moveHistory = snapshot.moveHistory.map((move) => ({ ...move }));
  gameState.turnNumber = snapshot.turnNumber;
  gameState.matchEndedAt = snapshot.matchEndedAt;
  gameState.matchRecorded = snapshot.matchRecorded;
  gameState.replay = createReplayState();
}

function undoLastMove() {
  if (gameState.mode !== "local") {
    setFeedback("Undo is available in Local 2 Player only.");
    return;
  }

  if (gameState.isAIThinking || gameState.undoStack.length === 0) {
    return;
  }

  const snapshot = gameState.undoStack.pop();
  restoreMatchSnapshot(snapshot);
  gameState.selectedPieceId = null;
  gameState.legalMoves = [];
  if (!gameState.winner) {
    startMatchTimer();
  }
  setFeedback("Last move undone.");
  renderBoard();
  updateStatus();
}

function setMoveFeedback(move, actor) {
  const piece = getPiece(move.pieceId);
  const side = piece ? piece.type : gameState.currentTurn;

  if (actor === "ai") {
    if (side === "wolf" && move.type === "capture") {
      setFeedback("AI wolf captured a sheep! Your turn.");
    } else if (side === "wolf") {
      setFeedback("AI wolf moved. Your turn.");
    } else {
      setFeedback("AI sheep moved to block the wolf. Your turn.");
    }
    return;
  }

  if (move.type === "capture") {
    setFeedback("Sheep captured. The flock is thinner.");
  } else {
    setFeedback(`${getTurnName(side)} moved.`);
  }
}

function checkWinCondition() {
  if (gameState.capturedSheep >= CAPTURES_TO_WIN) {
    finishMatch("wolf", "Wolf wins by capturing 7 sheep.");
    return;
  }

  const wolf = gameState.pieces.find((piece) => piece.type === "wolf");

  if (getLegalMoves(wolf.id).length === 0) {
    finishMatch("sheep", "Sheep win. The wolf is trapped.");
  }
}

function finishMatch(winner, message) {
  if (gameState.winner && gameState.matchRecorded) {
    return;
  }

  gameState.winner = winner;
  endMatchIfNeeded();
  handleVictoryAchievements(winner);
  playSound("victory");
  setFeedback(message);
}

function endMatchIfNeeded() {
  if (!gameState.matchEndedAt) {
    gameState.matchEndedAt = Date.now();
    stopMatchTimer();
    recordCompletedMatch();
  }
}

function switchTurn() {
  gameState.currentTurn = gameState.currentTurn === "wolf" ? "sheep" : "wolf";
}

function clearSelection(message = "Selection cleared.") {
  if (!gameState.selectedPieceId) {
    return;
  }

  gameState.selectedPieceId = null;
  gameState.legalMoves = [];
  setFeedback(message);
  renderBoard();
}

function updateStatus() {
  turnLabel.textContent = getTurnName(gameState.currentTurn);
  turnIcon.textContent = getTurnIcon(gameState.currentTurn);
  turnHelper.textContent = getTurnHelper(gameState.currentTurn);
  turnCard.classList.toggle("wolf-turn", gameState.currentTurn === "wolf");
  turnCard.classList.toggle("sheep-turn", gameState.currentTurn === "sheep");
  modeLabel.textContent = getModeName(gameState.mode);
  humanSideLabel.textContent = getHumanSideText();
  difficultyLabel.textContent = getDifficultyText();
  aiBanner.hidden = gameState.mode !== "singleplayer";
  aiStatsCard.hidden = gameState.mode !== "singleplayer";
  lastAIMoveLabel.textContent = gameState.aiStats.lastMove;
  nodesEvaluatedLabel.textContent = gameState.aiStats.nodesEvaluated;
  searchDepthLabel.textContent = gameState.aiStats.searchDepth;
  evaluationScoreLabel.textContent = gameState.aiStats.evaluationScore;
  updateAIPerformanceUI();
  capturedCount.textContent = gameState.capturedSheep;
  winnerMessage.classList.toggle("is-neutral", !gameState.winner);
  winnerMessage.classList.toggle("is-winner", Boolean(gameState.winner));

  if (gameState.winner === "wolf") {
    winnerMessage.textContent = "Wolf wins by capturing 7 sheep.";
  } else if (gameState.winner === "sheep") {
    winnerMessage.textContent = "Sheep win. The wolf is trapped.";
  } else {
    winnerMessage.textContent = "Game in progress";
  }

  feedbackMessage.textContent = gameState.feedbackMessage;
  updateMoveHistoryUI();
  updateMatchStatsUI();
  updateBalanceDashboard();
  updateAnalyticsDashboard();
  updateReplayControls();
  updateActionButtons();
  updateAchievementsUI();

  if (gameState.winner && !gameState.winOverlayShown && !gameState.replay.active) {
    showWinOverlay();
  }
}

function updateSelectionFeedback(piece) {
  const captureMoves = gameState.legalMoves.filter((move) => move.capturePieceId).length;

  if (gameState.legalMoves.length === 0) {
    setFeedback(`${getTurnName(piece.type)} has no legal moves.`);
  } else if (captureMoves > 0) {
    setFeedback(`${getTurnName(piece.type)} selected. Red/orange spots capture sheep.`);
  } else {
    setFeedback(`${getTurnName(piece.type)} selected. Choose a green spot.`);
  }
}

function setFeedback(message) {
  gameState.feedbackMessage = message;
  feedbackMessage.textContent = message;
}

function requestAnimationFrameSafe(callback) {
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(callback);
  } else {
    window.setTimeout(callback, 0);
  }
}

function loadPreferences() {
  return {
    soundMuted: readStorage(STORAGE_KEYS.soundMuted) === "true",
    tutorialSeen: readStorage(STORAGE_KEYS.tutorialSeen) === "true",
    preferredDifficulty: readStorage(STORAGE_KEYS.preferredDifficulty) || "normal"
  };
}

function loadAchievements() {
  try {
    return new Set(JSON.parse(readStorage(STORAGE_KEYS.achievements) || "[]"));
  } catch (error) {
    return new Set();
  }
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function savePreference(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Local storage can be unavailable in private contexts.
  }
}

function saveAchievements() {
  savePreference(STORAGE_KEYS.achievements, JSON.stringify([...unlockedAchievements]));
}

function loadGameHistory() {
  try {
    const parsed = JSON.parse(readStorage(STORAGE_KEYS.gameHistory) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY_MATCHES) : [];
  } catch (error) {
    return [];
  }
}

function saveGameHistory() {
  gameHistory = gameHistory.slice(-MAX_HISTORY_MATCHES);
  savePreference(STORAGE_KEYS.gameHistory, JSON.stringify(gameHistory));
}

function addGameHistoryRecord(record) {
  gameHistory.push(record);
  saveGameHistory();
}

function addGameHistoryRecords(records) {
  if (records.length === 0) {
    return;
  }

  gameHistory.push(...records);
  saveGameHistory();
}

function recordCompletedMatch() {
  if (gameState.matchRecorded || !gameState.winner) {
    return;
  }

  gameState.matchRecorded = true;
  addGameHistoryRecord(createCompletedMatchRecord("played"));
}

function createCompletedMatchRecord(source) {
  const captures = gameState.moveHistory.filter((move) => move.type === "capture").length;
  const matchLengthSeconds = Math.max(0, Math.round(getMatchDurationMs() / 1000));

  return {
    timestamp: new Date().toISOString(),
    mode: gameState.mode,
    difficulty: gameState.aiDifficulty || null,
    winner: gameState.winner,
    totalMoves: gameState.moveHistory.length,
    captures,
    matchLengthSeconds,
    humanSide: gameState.humanSide || null,
    source,
    openingPattern: getOpeningPattern(gameState.moveHistory),
    aiSummary: getCurrentMatchAISummary()
  };
}

function getCurrentMatchAISummary() {
  const aiMoveCount = gameState.aiStats.aiMoveCount || 0;

  return {
    moveCount: aiMoveCount,
    totalNodesEvaluated: gameState.aiStats.totalNodesEvaluated || gameState.aiStats.nodesEvaluated || 0,
    averageNodesEvaluated: aiMoveCount > 0 ? Math.round((gameState.aiStats.totalNodesEvaluated || 0) / aiMoveCount) : 0,
    averageSearchDepth: aiMoveCount > 0 ? roundToOne((gameState.aiStats.totalSearchDepth || 0) / aiMoveCount) : 0,
    averageMoveTimeMs: aiMoveCount > 0 ? Math.round((gameState.aiStats.totalMoveTimeMs || 0) / aiMoveCount) : 0,
    lastEvaluationScore: gameState.aiStats.evaluationScore || 0
  };
}

function getOpeningPattern(moveHistory) {
  const openingMoves = moveHistory.slice(0, 5);
  const firstWolfMove = openingMoves.find((move) => move.side === "wolf");
  const sheepMoves = openingMoves.filter((move) => move.side === "sheep");

  if (openingMoves.some((move) => move.type === "capture")) {
    return "Early capture pressure";
  }

  if (sheepMoves.length >= 3) {
    return "Sheep wall strategy";
  }

  if (!firstWolfMove) {
    return "No opening";
  }

  const target = nodeById[firstWolfMove.to];

  if (target && (target.col === 0 || target.col === BOARD_SIZE - 1 || target.row === BOARD_SIZE - 1)) {
    return "Wolf edge attack";
  }

  return "Wolf center attack";
}

function roundToOne(value) {
  return Math.round(value * 10) / 10;
}

function updateSoundToggle() {
  soundToggleButton.textContent = preferences.soundMuted ? "Sound Off" : "Sound On";
  soundToggleButton.setAttribute("aria-label", preferences.soundMuted ? "Unmute sound" : "Mute sound");
}

function toggleSound() {
  preferences.soundMuted = !preferences.soundMuted;
  savePreference(STORAGE_KEYS.soundMuted, String(preferences.soundMuted));
  updateSoundToggle();
}

function getAudioContext() {
  if (preferences.soundMuted) {
    return null;
  }

  if (!audioContext) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextConstructor) {
      return null;
    }

    audioContext = new AudioContextConstructor();
  }

  return audioContext;
}

function playSound(type) {
  const context = getAudioContext();

  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const soundMap = {
    button: { frequency: 360, duration: 0.06, volume: 0.035 },
    move: { frequency: 520, duration: 0.08, volume: 0.045 },
    capture: { frequency: 180, duration: 0.16, volume: 0.06 },
    victory: { frequency: 660, duration: 0.22, volume: 0.07 }
  };
  const sound = soundMap[type] || soundMap.move;

  oscillator.frequency.setValueAtTime(sound.frequency, now);
  oscillator.type = type === "capture" ? "sawtooth" : "sine";
  gain.gain.setValueAtTime(sound.volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + sound.duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + sound.duration);
}

function showTutorialIfNeeded() {
  if (preferences.tutorialSeen) {
    return;
  }

  tutorialStepIndex = 0;
  updateTutorialStep();
  tutorialOverlay.hidden = false;
}

function updateTutorialStep() {
  const step = TUTORIAL_STEPS[tutorialStepIndex];
  tutorialStepLabel.textContent = `Step ${tutorialStepIndex + 1} of ${TUTORIAL_STEPS.length}`;
  tutorialTitle.textContent = step.title;
  tutorialText.textContent = step.text;
  tutorialNextButton.textContent = tutorialStepIndex === TUTORIAL_STEPS.length - 1 ? "Done" : "Next";
}

function advanceTutorial() {
  playSound("button");

  if (tutorialStepIndex < TUTORIAL_STEPS.length - 1) {
    tutorialStepIndex += 1;
    updateTutorialStep();
    return;
  }

  closeTutorial();
}

function closeTutorial() {
  preferences.tutorialSeen = true;
  savePreference(STORAGE_KEYS.tutorialSeen, "true");
  tutorialOverlay.hidden = true;
}

function handleVictoryAchievements(winner) {
  const newlyUnlocked = [];

  newlyUnlocked.push(unlockAchievement("firstVictory"));

  if (winner === "sheep") {
    newlyUnlocked.push(unlockAchievement("wolfHunter"));
  }

  if (winner === "wolf") {
    newlyUnlocked.push(unlockAchievement("predator"));
  }

  if (gameState.mode === "singleplayer" && gameState.aiDifficulty === "hard" && winner === gameState.humanSide) {
    newlyUnlocked.push(unlockAchievement("strategist"));
  }

  gameState.lastUnlockedAchievements = newlyUnlocked.filter(Boolean);
}

function unlockAchievement(id) {
  if (unlockedAchievements.has(id)) {
    return null;
  }

  unlockedAchievements.add(id);
  saveAchievements();
  return ACHIEVEMENTS.find((achievement) => achievement.id === id)?.name || id;
}

function updateAchievementsUI() {
  achievementList.innerHTML = "";

  ACHIEVEMENTS.forEach((achievement) => {
    const item = document.createElement("li");
    const isUnlocked = unlockedAchievements.has(achievement.id);
    item.innerHTML = `<strong>${achievement.name}</strong><span>${isUnlocked ? "Unlocked" : "Locked"}</span>`;
    achievementList.appendChild(item);
  });
}

function showWinOverlay() {
  gameState.winOverlayShown = true;
  const wolfWon = gameState.winner === "wolf";

  winIcon.textContent = wolfWon ? "🐺" : "🐑";
  winTitle.textContent = wolfWon ? "Wolf Wins" : "Sheep Win";
  winReason.textContent = wolfWon ? "Captured enough sheep." : "The wolf has been trapped.";

  if (gameState.lastUnlockedAchievements?.length) {
    achievementToast.hidden = false;
    achievementToast.textContent = `Achievement unlocked: ${gameState.lastUnlockedAchievements.join(", ")}`;
  } else {
    achievementToast.hidden = true;
    achievementToast.textContent = "";
  }

  winOverlay.hidden = false;
}

function hideWinOverlay() {
  winOverlay.hidden = true;
}

function updateMoveHistoryUI() {
  moveHistoryList.innerHTML = "";

  gameState.moveHistory.forEach((move) => {
    const item = document.createElement("li");
    item.textContent = formatMoveHistoryEntry(move);
    moveHistoryList.appendChild(item);
  });

  moveHistoryList.scrollTop = moveHistoryList.scrollHeight;
}

function formatMoveHistoryEntry(move) {
  if (move.type === "capture") {
    return `${getTurnName(move.side)}: Capture ${move.from} to ${move.to}`;
  }

  return `${getTurnName(move.side)}: ${move.from} to ${move.to}`;
}

function updateMatchStatsUI() {
  const captures = gameState.moveHistory.filter((move) => move.type === "capture").length;
  totalMovesLabel.textContent = gameState.moveHistory.length;
  capturesLabel.textContent = captures;
  matchLengthLabel.textContent = formatDuration(getMatchDurationMs());
  winnerStatLabel.textContent = gameState.winner ? getTurnName(gameState.winner) : "None";
}

function updateBalanceDashboard() {
  wolfMobilityLabel.textContent = evaluateWolfMobility();
  remainingSheepLabel.textContent = gameState.pieces.filter((piece) => piece.type === "sheep" && !piece.captured).length;
  balanceCapturedLabel.textContent = gameState.capturedSheep;
}

function updateAIPerformanceUI() {
  const currentSummary = getCurrentMatchAISummary();
  const lifetimeSummary = getLifetimeAISummary();

  currentAIMoveTimeLabel.textContent = `${currentSummary.averageMoveTimeMs}ms`;
  lifetimeAINodesLabel.textContent = lifetimeSummary.averageNodesEvaluated;
  lifetimeAIDepthLabel.textContent = lifetimeSummary.averageSearchDepth;
  lifetimeAIMoveTimeLabel.textContent = `${lifetimeSummary.averageMoveTimeMs}ms`;
}

function getLifetimeAISummary() {
  const summaries = gameHistory
    .map((match) => match.aiSummary)
    .filter((summary) => summary && summary.moveCount > 0);
  const totalMoves = summaries.reduce((sum, summary) => sum + summary.moveCount, 0);

  if (totalMoves === 0) {
    return {
      averageNodesEvaluated: 0,
      averageSearchDepth: 0,
      averageMoveTimeMs: 0
    };
  }

  const totalNodes = summaries.reduce((sum, summary) => sum + (summary.totalNodesEvaluated || summary.averageNodesEvaluated * summary.moveCount || 0), 0);
  const totalDepth = summaries.reduce((sum, summary) => sum + (summary.averageSearchDepth || 0) * summary.moveCount, 0);
  const totalTime = summaries.reduce((sum, summary) => sum + (summary.averageMoveTimeMs || 0) * summary.moveCount, 0);

  return {
    averageNodesEvaluated: Math.round(totalNodes / totalMoves),
    averageSearchDepth: roundToOne(totalDepth / totalMoves),
    averageMoveTimeMs: Math.round(totalTime / totalMoves)
  };
}

function updateAnalyticsDashboard() {
  const stats = getBalanceStats(gameHistory);
  const insights = getBalanceInsights(stats);

  historyTotalMatchesLabel.textContent = stats.totalMatches;
  historyWolfWinsLabel.textContent = stats.wolfWins;
  historySheepWinsLabel.textContent = stats.sheepWins;
  historyWolfRateLabel.textContent = `${stats.wolfWinRate}%`;
  historySheepRateLabel.textContent = `${stats.sheepWinRate}%`;
  averageMatchLengthLabel.textContent = formatDuration(stats.averageMatchLengthSeconds * 1000);
  averageCapturesLabel.textContent = stats.averageCaptures;
  shortMatchRateLabel.textContent = `${stats.lengthBuckets.short}%`;
  mediumMatchRateLabel.textContent = `${stats.lengthBuckets.medium}%`;
  longMatchRateLabel.textContent = `${stats.lengthBuckets.long}%`;
  commonOpeningLabel.textContent = stats.mostCommonOpening || "None";
  successfulOpeningLabel.textContent = stats.mostSuccessfulOpening || "None";
  updateDifficultyStatsUI(stats.byDifficulty);
  updateInsightsUI(balanceInsightsList, insights);
}

function getBalanceStats(history) {
  const totalMatches = history.length;
  const wolfWins = history.filter((match) => match.winner === "wolf").length;
  const sheepWins = history.filter((match) => match.winner === "sheep").length;
  const averageMatchLengthSeconds = totalMatches > 0
    ? Math.round(history.reduce((sum, match) => sum + (match.matchLengthSeconds || 0), 0) / totalMatches)
    : 0;
  const averageCaptures = totalMatches > 0
    ? roundToOne(history.reduce((sum, match) => sum + (match.captures || 0), 0) / totalMatches)
    : 0;

  return {
    totalMatches,
    wolfWins,
    sheepWins,
    wolfWinRate: getPercentage(wolfWins, totalMatches),
    sheepWinRate: getPercentage(sheepWins, totalMatches),
    averageMatchLengthSeconds,
    averageMoves: totalMatches > 0 ? roundToOne(history.reduce((sum, match) => sum + (match.totalMoves || 0), 0) / totalMatches) : 0,
    averageCaptures,
    byDifficulty: getDifficultyStats(history),
    lengthBuckets: getMatchLengthBuckets(history),
    mostCommonOpening: getMostCommonOpening(history),
    mostSuccessfulOpening: getMostSuccessfulOpening(history)
  };
}

function getDifficultyStats(history) {
  return ["easy", "normal", "hard"].map((difficulty) => {
    const matches = history.filter((match) => match.difficulty === difficulty);

    return {
      difficulty,
      matches: matches.length,
      wolfWins: matches.filter((match) => match.winner === "wolf").length,
      sheepWins: matches.filter((match) => match.winner === "sheep").length
    };
  });
}

function updateDifficultyStatsUI(statsByDifficulty) {
  difficultyStatsList.innerHTML = "";

  statsByDifficulty.forEach((item) => {
    const row = document.createElement("div");
    row.className = "stats-row";
    row.innerHTML = `<strong>${getDifficultyName(item.difficulty)}</strong><span>${item.matches} matches</span><span>🐺 ${item.wolfWins}</span><span>🐑 ${item.sheepWins}</span>`;
    difficultyStatsList.appendChild(row);
  });
}

function getMatchLengthBuckets(history) {
  const totalMatches = history.length;
  const shortMatches = history.filter((match) => match.totalMoves < 20).length;
  const mediumMatches = history.filter((match) => match.totalMoves >= 20 && match.totalMoves <= 50).length;
  const longMatches = history.filter((match) => match.totalMoves > 50).length;

  return {
    short: getPercentage(shortMatches, totalMatches),
    medium: getPercentage(mediumMatches, totalMatches),
    long: getPercentage(longMatches, totalMatches)
  };
}

function getMostCommonOpening(history) {
  const counts = countBy(history.map((match) => match.openingPattern || "Unknown"));
  return getTopCountKey(counts);
}

function getMostSuccessfulOpening(history) {
  const openingScores = {};

  history.forEach((match) => {
    const opening = match.openingPattern || "Unknown";

    if (!openingScores[opening]) {
      openingScores[opening] = { matches: 0, wolfWins: 0, sheepWins: 0 };
    }

    openingScores[opening].matches += 1;
    openingScores[opening].wolfWins += match.winner === "wolf" ? 1 : 0;
    openingScores[opening].sheepWins += match.winner === "sheep" ? 1 : 0;
  });

  return Object.entries(openingScores)
    .filter(([, score]) => score.matches >= 2)
    .sort(([, a], [, b]) => Math.max(b.wolfWins, b.sheepWins) / b.matches - Math.max(a.wolfWins, a.sheepWins) / a.matches)[0]?.[0] || "";
}

function getBalanceInsights(stats) {
  const insights = [];

  if (stats.totalMatches === 0) {
    return ["Play or simulate matches to collect balance data."];
  }

  if (stats.wolfWinRate > 65) {
    insights.push(`Wolf is winning ${stats.wolfWinRate}% of matches.`);
  } else if (stats.sheepWinRate > 65) {
    insights.push(`Sheep is winning ${stats.sheepWinRate}% of matches.`);
  } else {
    insights.push("Win rates are currently close enough for more testing.");
  }

  if (stats.averageMoves < 15) {
    insights.push("Average match length is very short. Consider increasing the capture target.");
  } else if (stats.averageMoves > 60) {
    insights.push("Average match length is long. Consider lowering the capture target.");
  }

  const hardStats = stats.byDifficulty.find((item) => item.difficulty === "hard");
  const easyStats = stats.byDifficulty.find((item) => item.difficulty === "easy");

  if (hardStats?.matches > 0 && easyStats?.matches > 0) {
    const hardWolfRate = getPercentage(hardStats.wolfWins, hardStats.matches);
    const easyWolfRate = getPercentage(easyStats.wolfWins, easyStats.matches);

    if (Math.abs(hardWolfRate - easyWolfRate) < 8) {
      insights.push("Hard AI is not clearly separating from Easy yet.");
    } else if (hardWolfRate > easyWolfRate) {
      insights.push("Wolf win rate increased on Hard.");
    } else {
      insights.push("Sheep win rate increased on Hard.");
    }
  }

  return insights;
}

function updateInsightsUI(listElement, insights) {
  listElement.innerHTML = "";

  insights.forEach((insight) => {
    const item = document.createElement("li");
    item.textContent = insight;
    listElement.appendChild(item);
  });
}

function getPercentage(part, total) {
  return total > 0 ? Math.round(part / total * 100) : 0;
}

function countBy(items) {
  return items.reduce((counts, item) => {
    counts[item] = (counts[item] || 0) + 1;
    return counts;
  }, {});
}

function getTopCountKey(counts) {
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || "";
}

function updateReplayControls() {
  const canReplay = Boolean(gameState.winner) && gameState.moveHistory.length > 0;
  const replayActive = gameState.replay.active;
  replayButton.disabled = !canReplay;
  firstReplayButton.disabled = !canReplay;
  previousReplayButton.disabled = !replayActive || gameState.replay.index <= 0;
  nextReplayButton.disabled = !replayActive || gameState.replay.index >= gameState.moveHistory.length;
  lastReplayButton.disabled = !canReplay;

  if (replayActive) {
    replayStatusLabel.textContent = `Replay move ${gameState.replay.index} of ${gameState.moveHistory.length}.`;
  } else if (canReplay) {
    replayStatusLabel.textContent = "Replay ready.";
  } else {
    replayStatusLabel.textContent = "Replay available after game ends.";
  }
}

function updateActionButtons() {
  undoButton.disabled = gameState.mode !== "local" || gameState.undoStack.length === 0 || gameState.isAIThinking || gameState.replay.active || Boolean(gameState.winner) || isSimulationRunning;
  [simulate10Button, simulate50Button, simulate100Button].forEach((button) => {
    button.disabled = isSimulationRunning;
  });
}

function startMatchTimer() {
  stopMatchTimer();
  matchTimerId = window.setInterval(updateMatchStatsUI, 1000);
}

function stopMatchTimer() {
  if (matchTimerId) {
    window.clearInterval(matchTimerId);
    matchTimerId = null;
  }
}

function getMatchDurationMs() {
  if (!gameState.matchStartedAt) {
    return 0;
  }

  return (gameState.matchEndedAt || Date.now()) - gameState.matchStartedAt;
}

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function exportMatchData() {
  const payload = getMatchExportData();
  downloadJSON(payload, `wolf-vs-sheep-${Date.now()}.json`);
  setFeedback("Match data exported.");
}

function exportAllAnalytics() {
  const payload = {
    timestamp: new Date().toISOString(),
    matchHistory: gameHistory,
    balanceStats: getBalanceStats(gameHistory),
    aiStats: {
      currentMatch: getCurrentMatchAISummary(),
      lifetimeAverage: getLifetimeAISummary()
    },
    achievements: [...unlockedAchievements],
    settings: {
      soundMuted: preferences.soundMuted,
      tutorialSeen: preferences.tutorialSeen,
      preferredDifficulty: preferences.preferredDifficulty
    }
  };

  downloadJSON(payload, `wolf-vs-sheep-analytics-${Date.now()}.json`);
  setFeedback("Analytics exported.");
}

function downloadJSON(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getMatchExportData() {
  return {
    timestamp: new Date().toISOString(),
    mode: gameState.mode,
    difficulty: gameState.aiDifficulty,
    winner: gameState.winner,
    moveHistory: gameState.moveHistory,
    capturedSheep: gameState.capturedSheep,
    matchLengthMs: getMatchDurationMs(),
    aiStats: gameState.aiStats,
    openingPattern: getOpeningPattern(gameState.moveHistory)
  };
}

function createReplayState() {
  return {
    active: false,
    index: 0,
    pieces: []
  };
}

function startReplay() {
  if (!gameState.winner || gameState.moveHistory.length === 0) {
    return;
  }

  hideWinOverlay();
  setReplayIndex(0);
  setFeedback("Replay started.");
}

function setReplayIndex(index) {
  const clampedIndex = Math.max(0, Math.min(index, gameState.moveHistory.length));
  gameState.replay = {
    active: true,
    index: clampedIndex,
    pieces: buildReplayPieces(clampedIndex)
  };
  renderBoard();
  updateStatus();
}

function buildReplayPieces(moveCount) {
  const replayPieces = initialPieces.map((piece) => ({ ...piece, captured: false }));

  gameState.moveHistory.slice(0, moveCount).forEach((move) => {
    const piece = replayPieces.find((candidate) => candidate.id === move.pieceId || (candidate.type === move.side && candidate.nodeId === move.from));

    if (piece) {
      piece.nodeId = move.to;
    }

    if (move.capturedPieceId) {
      const capturedPiece = replayPieces.find((candidate) => candidate.id === move.capturedPieceId);

      if (capturedPiece) {
        capturedPiece.captured = true;
      }
    }
  });

  return replayPieces;
}

function toggleDebugMode() {
  gameState.debugMode = debugToggle.checked;
  developerPanel.hidden = !gameState.debugMode;
  renderBoard();
  updateStatus();
}

function resetDebugUI() {
  debugToggle.checked = false;
  developerPanel.hidden = true;
}

function forceWin(winner) {
  if (!gameState.debugMode || gameState.screen !== "game" || gameState.winner) {
    return;
  }

  if (winner === "wolf") {
    gameState.capturedSheep = Math.max(gameState.capturedSheep, CAPTURES_TO_WIN);
  }

  finishMatch(winner, winner === "wolf" ? "Developer forced a wolf win." : "Developer forced a sheep win.");
  renderBoard();
  updateStatus();
}

function addDeveloperCapture() {
  if (!gameState.debugMode || gameState.screen !== "game" || gameState.winner) {
    return;
  }

  const sheep = gameState.pieces.find((piece) => piece.type === "sheep" && !piece.captured);

  if (!sheep) {
    return;
  }

  sheep.captured = true;
  gameState.capturedSheep += 1;
  gameState.moveHistory.push({
    turn: gameState.turnNumber + 1,
    pieceId: "wolf",
    side: "wolf",
    from: getPiece("wolf")?.nodeId || "n22",
    to: getPiece("wolf")?.nodeId || "n22",
    type: "capture",
    actor: "developer",
    capturedPieceId: sheep.id
  });
  gameState.turnNumber += 1;
  setFeedback("Developer capture added.");
  checkWinCondition();
  renderBoard();
  updateStatus();
}

function resetAnalytics() {
  if (!gameState.debugMode) {
    return;
  }

  gameHistory = [];
  saveGameHistory();
  setFeedback("Analytics reset.");
  updateStatus();
}

function generateTestMatch() {
  if (!gameState.debugMode) {
    return;
  }

  const totalMoves = 12 + Math.floor(Math.random() * 48);
  const captures = Math.min(CAPTURES_TO_WIN, Math.floor(Math.random() * 8));
  const winner = captures >= CAPTURES_TO_WIN || Math.random() > 0.48 ? "wolf" : "sheep";
  const difficulty = ["easy", "normal", "hard"][Math.floor(Math.random() * 3)];

  addGameHistoryRecord({
    timestamp: new Date().toISOString(),
    mode: Math.random() > 0.5 ? "singleplayer" : "local",
    difficulty,
    winner,
    totalMoves,
    captures,
    matchLengthSeconds: totalMoves * (2 + Math.floor(Math.random() * 4)),
    humanSide: Math.random() > 0.5 ? "wolf" : "sheep",
    source: "developer-test",
    openingPattern: ["Wolf center attack", "Wolf edge attack", "Sheep wall strategy", "Early capture pressure"][Math.floor(Math.random() * 4)],
    aiSummary: {
      moveCount: Math.floor(totalMoves / 2),
      totalNodesEvaluated: 400 + Math.floor(Math.random() * 2400),
      averageNodesEvaluated: 80 + Math.floor(Math.random() * 340),
      averageSearchDepth: difficulty === "hard" ? 4 : difficulty === "normal" ? 2 : 0,
      averageMoveTimeMs: 20 + Math.floor(Math.random() * 180),
      lastEvaluationScore: Math.floor(Math.random() * 200) - 100
    }
  });
  setFeedback("Generated a test match for analytics.");
  updateStatus();
}

async function runAISimulations(matchCount) {
  if (isSimulationRunning) {
    return;
  }

  const difficulty = gameState.aiDifficulty || preferences.preferredDifficulty || "normal";
  const records = [];
  const results = {
    matches: 0,
    wolfWins: 0,
    sheepWins: 0,
    totalMoves: 0,
    totalCaptures: 0,
    adjudicated: 0
  };

  isSimulationRunning = true;
  simulationStatusLabel.textContent = `Running ${matchCount} ${getDifficultyName(difficulty)} AI vs AI matches...`;
  updateActionButtons();

  for (let index = 0; index < matchCount; index += 1) {
    const record = runSimulatedMatch(difficulty);
    records.push(record);
    results.matches += 1;
    results.wolfWins += record.winner === "wolf" ? 1 : 0;
    results.sheepWins += record.winner === "sheep" ? 1 : 0;
    results.totalMoves += record.totalMoves;
    results.totalCaptures += record.captures;
    results.adjudicated += record.adjudicated ? 1 : 0;

    if ((index + 1) % 5 === 0 || index === matchCount - 1) {
      updateSimulationResults(results, matchCount);
      await waitForBrowser();
    }
  }

  addGameHistoryRecords(records);
  isSimulationRunning = false;
  simulationStatusLabel.textContent = `Completed ${matchCount} ${getDifficultyName(difficulty)} AI vs AI matches.`;
  updateSimulationResults(results, matchCount);
  updateStatus();
}

function runSimulatedMatch(difficulty) {
  const liveState = gameState;
  const startedAt = Date.now();
  let adjudicated = false;
  let record;

  gameState = createInitialState({
    screen: "simulation",
    mode: "simulation",
    aiDifficulty: difficulty,
    currentTurn: "wolf",
    matchStartedAt: startedAt,
    pieces: initialPieces.map((piece) => ({ ...piece, captured: false }))
  });

  for (let turn = 0; turn < SIMULATION_MAX_TURNS && !gameState.winner; turn += 1) {
    const moves = getAllLegalMovesForSide(gameState.currentTurn);

    if (moves.length === 0) {
      if (gameState.currentTurn === "wolf") {
        gameState.winner = "sheep";
        break;
      }

      switchTurn();
      continue;
    }

    const move = chooseAIMove() || pickRandom(moves);
    applyMoveForSimulation(move);
    const winner = getWinnerForCurrentState();

    if (winner) {
      gameState.winner = winner;
      break;
    }

    switchTurn();
  }

  if (!gameState.winner) {
    adjudicated = true;
    gameState.winner = gameState.capturedSheep >= Math.ceil(CAPTURES_TO_WIN / 2) ? "wolf" : "sheep";
  }

  gameState.matchEndedAt = startedAt + Math.max(1, gameState.moveHistory.length) * 2500;
  record = createCompletedMatchRecord("simulation");
  record.adjudicated = adjudicated;
  gameState = liveState;
  return record;
}

function applyMoveForSimulation(move) {
  const piece = getPiece(move.pieceId);

  if (!piece) {
    return;
  }

  piece.nodeId = move.to;

  if (move.capturedPieceId) {
    const capturedPiece = getPiece(move.capturedPieceId);

    if (capturedPiece && !capturedPiece.captured) {
      capturedPiece.captured = true;
      gameState.capturedSheep += 1;
    }
  }

  gameState.moveHistory.push({
    turn: gameState.turnNumber + 1,
    pieceId: move.pieceId,
    side: piece.type,
    from: move.from,
    to: move.to,
    type: move.type,
    actor: "simulation-ai",
    capturedPieceId: move.capturedPieceId || undefined
  });
  gameState.turnNumber += 1;
}

function updateSimulationResults(results, requestedMatches) {
  const completedMatches = Math.max(1, results.matches);
  const wolfRate = getPercentage(results.wolfWins, results.matches);
  const averageMoves = roundToOne(results.totalMoves / completedMatches);

  simulationWolfWinsLabel.textContent = results.wolfWins;
  simulationSheepWinsLabel.textContent = results.sheepWins;
  simulationAverageLengthLabel.textContent = `${averageMoves} moves`;
  simulationWolfRateLabel.textContent = `${wolfRate}%`;
  updateInsightsUI(simulationRecommendationsList, getSimulationRecommendations({
    ...results,
    requestedMatches,
    averageMoves,
    wolfWinRate: wolfRate,
    sheepWinRate: getPercentage(results.sheepWins, results.matches)
  }));
}

function getSimulationRecommendations(results) {
  if (results.matches === 0) {
    return ["Run simulations to generate recommendations."];
  }

  const recommendations = [];

  if (results.wolfWinRate > 65) {
    recommendations.push("Wolf may be overpowered.");
  } else if (results.sheepWinRate > 65) {
    recommendations.push("Sheep may be overpowered.");
  } else {
    recommendations.push("Simulation win rates look reasonably balanced.");
  }

  if (results.averageMoves < 15) {
    recommendations.push("Matches may be too short.");
  } else if (results.averageMoves > 60) {
    recommendations.push("Matches may be too long.");
  }

  if (results.adjudicated > 0) {
    recommendations.push(`${results.adjudicated} simulations reached the turn cap.`);
  }

  return recommendations;
}

function waitForBrowser() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function getTurnName(type) {
  return type === "wolf" ? "Wolf" : "Sheep";
}

function getTurnIcon(type) {
  return type === "wolf" ? "🐺" : "🐑";
}

function getTurnHelper(type) {
  return type === "wolf" ? "Capture sheep or reposition." : "Block the wolf's escape.";
}

function getModeName(mode) {
  return mode === "singleplayer" ? "Single Player" : "Local 2 Player";
}

function getHumanSideText() {
  if (gameState.mode !== "singleplayer") {
    return "";
  }

  return `You are: ${getTurnName(gameState.humanSide)}`;
}

function getDifficultyText() {
  if (gameState.mode !== "singleplayer") {
    return "";
  }

  return `Difficulty: ${getDifficultyName(gameState.aiDifficulty)}`;
}

function getDifficultyName(difficulty) {
  if (difficulty === "hard") {
    return "Hard";
  }

  if (difficulty === "normal") {
    return "Normal";
  }

  return "Easy";
}

function getMinimaxDepth(difficulty) {
  if (difficulty === "hard") {
    return 4;
  }

  return 2;
}

function getAIThinkingMessage() {
  if (gameState.aiDifficulty === "hard") {
    return "AI is calculating...";
  }

  if (gameState.aiDifficulty === "normal") {
    return "AI is planning ahead...";
  }

  return "AI is thinking...";
}

function getAIMoveLabel(move) {
  if (!move) {
    return "None";
  }

  if (move.type === "capture") {
    return "Capture";
  }

  return gameState.currentTurn === "sheep" ? "Block" : "Move";
}

function getOppositeSide(side) {
  return side === "wolf" ? "sheep" : "wolf";
}

function getWinnerForCurrentState() {
  if (gameState.capturedSheep >= CAPTURES_TO_WIN) {
    return "wolf";
  }

  const wolf = gameState.pieces.find((piece) => piece.type === "wolf" && !piece.captured);

  if (wolf && getLegalMoves(wolf.id).length === 0) {
    return "sheep";
  }

  return null;
}

function canAcceptHumanInput() {
  if (gameState.winner || gameState.isAIThinking || gameState.replay.active) {
    return false;
  }

  if (gameState.mode === "local") {
    return true;
  }

  return gameState.mode === "singleplayer" && gameState.currentTurn === gameState.humanSide;
}

function canHumanControlPiece(piece) {
  return canAcceptHumanInput() && piece.type === gameState.currentTurn;
}

function maybeHandleAITurn() {
  if (gameState.mode === "singleplayer" && !gameState.winner && !gameState.isAIThinking && gameState.currentTurn !== gameState.humanSide) {
    handleAITurn();
  }
}

function handleAITurn() {
  if (gameState.mode !== "singleplayer" || gameState.currentTurn === gameState.humanSide || gameState.winner) {
    return;
  }

  const aiTurnToken = cancelPendingAITurn();
  gameState.aiTurnToken = aiTurnToken;
  gameState.isAIThinking = true;
  gameState.selectedPieceId = null;
  gameState.legalMoves = [];
  setFeedback(getAIThinkingMessage());
  renderBoard();
  updateStatus();

  window.setTimeout(() => {
    if (!isCurrentAITurn(aiTurnToken)) {
      return;
    }

    const aiMove = chooseAIMove();
    gameState.isAIThinking = false;

    if (!aiMove) {
      setFeedback("AI has no legal moves. Your turn.");
      switchTurn();
      renderBoard();
      updateStatus();
      maybeHandleAITurn();
      return;
    }

    executeMove(aiMove, "ai");
  }, AI_THINK_DELAY);
}

function cancelPendingAITurn() {
  aiTurnSequence += 1;
  return aiTurnSequence;
}

function isCurrentAITurn(aiTurnToken) {
  return gameState.screen === "game" &&
    gameState.mode === "singleplayer" &&
    gameState.isAIThinking &&
    gameState.aiTurnToken === aiTurnToken &&
    !gameState.winner &&
    gameState.currentTurn !== gameState.humanSide;
}

function chooseAIMove() {
  const aiSide = gameState.currentTurn;
  const difficulty = gameState.aiDifficulty || "easy";
  const searchStats = { nodesEvaluated: 0 };
  const startedAt = getNowMs();
  const aiMove = difficulty === "easy"
    ? chooseEasyAIMove(searchStats)
    : chooseMinimaxAIMove(aiSide, getMinimaxDepth(difficulty), searchStats);
  const moveTimeMs = Math.max(1, Math.round(getNowMs() - startedAt));
  const previousStats = gameState.aiStats || {};
  const nextMoveCount = (previousStats.aiMoveCount || 0) + 1;
  const nextNodesTotal = (previousStats.totalNodesEvaluated || 0) + (searchStats.nodesEvaluated || 0);
  const nextDepthTotal = (previousStats.totalSearchDepth || 0) + (searchStats.searchDepth || 0);
  const nextMoveTimeTotal = (previousStats.totalMoveTimeMs || 0) + moveTimeMs;

  gameState.aiStats = {
    lastMove: getAIMoveLabel(aiMove),
    nodesEvaluated: searchStats.nodesEvaluated,
    searchDepth: searchStats.searchDepth || 0,
    evaluationScore: Math.round(searchStats.evaluationScore || 0),
    lastMoveTimeMs: moveTimeMs,
    totalNodesEvaluated: nextNodesTotal,
    totalSearchDepth: nextDepthTotal,
    totalMoveTimeMs: nextMoveTimeTotal,
    aiMoveCount: nextMoveCount
  };

  return aiMove;
}

function getNowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function chooseEasyAIMove(searchStats) {
  const moves = getAllLegalMovesForSide(gameState.currentTurn);
  searchStats.nodesEvaluated = Math.max(1, moves.length);
  searchStats.searchDepth = 0;
  searchStats.evaluationScore = evaluatePosition(gameState.currentTurn);

  return gameState.currentTurn === "wolf" ? chooseWolfAIMove() : chooseSheepAIMove();
}

function chooseWolfAIMove() {
  const moves = getAllLegalMovesForSide("wolf");
  const captureMoves = moves.filter((move) => move.type === "capture");
  const candidateMoves = captureMoves.length > 0 ? captureMoves : moves;

  return chooseBestMove(candidateMoves, (move) => {
    const snapshot = simulateMove(move);
    const score = evaluateWolfMobility();
    undoSimulatedMove(snapshot);
    return score;
  }, "max");
}

function chooseSheepAIMove() {
  const moves = getAllLegalMovesForSide("sheep");

  if (moves.length === 0) {
    return null;
  }

  const evaluatedMoves = moves.map((move) => {
    const snapshot = simulateMove(move);
    const wolfMobility = evaluateWolfMobility();
    const allowsCapture = getWolfLegalMoves().some((wolfMove) => wolfMove.type === "capture");
    undoSimulatedMove(snapshot);

    return {
      move,
      allowsCapture,
      wolfMobility
    };
  });

  const safestMoves = evaluatedMoves.filter((item) => item.allowsCapture === false);
  const candidateMoves = safestMoves.length > 0 ? safestMoves : evaluatedMoves;
  const lowestMobility = Math.min(...candidateMoves.map((item) => item.wolfMobility));
  const bestMoves = candidateMoves
    .filter((item) => item.wolfMobility === lowestMobility)
    .map((item) => item.move);

  return pickRandom(bestMoves);
}

function chooseMinimaxAIMove(aiSide, depth, searchStats) {
  const moves = orderMovesForSearch(getAllLegalMovesForSide(aiSide), aiSide);
  let bestScore = -Infinity;
  let bestMoves = [];
  const context = {
    aiSide,
    nodeLimit: MINIMAX_NODE_LIMIT,
    nodesEvaluated: 0
  };

  if (moves.length === 0) {
    searchStats.nodesEvaluated = 1;
    searchStats.searchDepth = depth;
    searchStats.evaluationScore = evaluatePosition(aiSide);
    return null;
  }

  moves.forEach((move) => {
    const snapshot = simulateMove(move);
    gameState.currentTurn = getOppositeSide(aiSide);
    const result = minimax(depth - 1, gameState.currentTurn === aiSide, context);
    undoSimulatedMove(snapshot);

    if (result.score > bestScore) {
      bestScore = result.score;
      bestMoves = [move];
    } else if (result.score === bestScore) {
      bestMoves.push(move);
    }
  });

  searchStats.nodesEvaluated = context.nodesEvaluated;
  searchStats.searchDepth = depth;
  searchStats.evaluationScore = bestScore;
  return pickRandom(bestMoves);
}

function minimax(depth, maximizingPlayer, context) {
  context.nodesEvaluated += 1;

  const winner = getWinnerForCurrentState();

  if (winner || depth === 0 || context.nodesEvaluated >= context.nodeLimit) {
    return {
      score: evaluatePosition(context.aiSide),
      move: null
    };
  }

  const side = gameState.currentTurn;
  const moves = orderMovesForSearch(getAllLegalMovesForSide(side), side);

  if (moves.length === 0) {
    return {
      score: evaluatePosition(context.aiSide),
      move: null
    };
  }

  let bestScore = maximizingPlayer ? -Infinity : Infinity;
  let bestMove = null;

  moves.forEach((move) => {
    if (context.nodesEvaluated >= context.nodeLimit) {
      return;
    }

    const snapshot = simulateMove(move);
    gameState.currentTurn = getOppositeSide(side);
    const result = minimax(depth - 1, gameState.currentTurn === context.aiSide, context);
    undoSimulatedMove(snapshot);

    if (maximizingPlayer && result.score > bestScore) {
      bestScore = result.score;
      bestMove = move;
    }

    if (!maximizingPlayer && result.score < bestScore) {
      bestScore = result.score;
      bestMove = move;
    }
  });

  return {
    score: bestScore,
    move: bestMove
  };
}

function evaluatePosition(aiSide) {
  const winner = getWinnerForCurrentState();

  if (winner === aiSide) {
    return 100000 + gameState.capturedSheep * 100;
  }

  if (winner && winner !== aiSide) {
    return -100000 - gameState.capturedSheep * 100;
  }

  const wolf = gameState.pieces.find((piece) => piece.type === "wolf" && !piece.captured);
  const wolfMoves = getWolfLegalMoves();
  const wolfCaptures = wolfMoves.filter((move) => move.type === "capture").length;
  const wolfMobility = wolfMoves.length;
  const adjacentSheep = wolf ? adjacency[wolf.nodeId]
    .map((nodeId) => getPieceAtNode(nodeId))
    .filter((piece) => piece && piece.type === "sheep").length : 0;
  const emptyAdjacent = wolf ? adjacency[wolf.nodeId]
    .filter((nodeId) => !getPieceAtNode(nodeId)).length : 0;
  const sheepRemaining = gameState.pieces.filter((piece) => piece.type === "sheep" && !piece.captured).length;
  const wolfScore =
    gameState.capturedSheep * 55 +
    wolfMobility * 10 +
    wolfCaptures * 32 +
    emptyAdjacent * 7 -
    adjacentSheep * 12;
  const sheepScore =
    sheepRemaining * 28 -
    gameState.capturedSheep * 45 -
    wolfMobility * 14 -
    wolfCaptures * 42 +
    adjacentSheep * 16 -
    emptyAdjacent * 6;

  return aiSide === "wolf" ? wolfScore : sheepScore;
}

function orderMovesForSearch(moves, side) {
  return [...moves].sort((a, b) => getMoveOrderingScore(b, side) - getMoveOrderingScore(a, side));
}

function getMoveOrderingScore(move, side) {
  let score = move.type === "capture" ? 10000 : 0;

  if (side === "sheep") {
    const wolf = gameState.pieces.find((piece) => piece.type === "wolf" && !piece.captured);

    if (wolf && areConnected(move.to, wolf.nodeId)) {
      score += 600;
    }

    score += adjacency[move.to].filter((nodeId) => getPieceAtNode(nodeId)?.type === "sheep").length * 50;
  } else {
    const target = nodeById[move.to];
    score += (4 - Math.abs(2 - target.row) - Math.abs(2 - target.col)) * 20;
  }

  return score;
}

function chooseBestMove(moves, scoreMove, direction) {
  if (moves.length === 0) {
    return null;
  }

  const scores = moves.map((move) => ({
    move,
    score: scoreMove(move)
  }));
  const bestScore = direction === "max"
    ? Math.max(...scores.map((item) => item.score))
    : Math.min(...scores.map((item) => item.score));
  const bestMoves = scores
    .filter((item) => item.score === bestScore)
    .map((item) => item.move);

  return pickRandom(bestMoves);
}

function getAllLegalMovesForSide(side) {
  return gameState.pieces
    .filter((piece) => !piece.captured && piece.type === side)
    .flatMap((piece) => getLegalMoves(piece.id).map((move) => createMoveObject(piece, move)));
}

function getWolfLegalMoves() {
  return getAllLegalMovesForSide("wolf");
}

function simulateMove(move) {
  const snapshot = {
    pieces: gameState.pieces.map((piece) => ({ ...piece })),
    capturedSheep: gameState.capturedSheep,
    currentTurn: gameState.currentTurn,
    winner: gameState.winner
  };
  const piece = getPiece(move.pieceId);

  if (piece) {
    piece.nodeId = move.to;
  }

  if (move.capturedPieceId) {
    const capturedPiece = getPiece(move.capturedPieceId);

    if (capturedPiece && !capturedPiece.captured) {
      capturedPiece.captured = true;
      gameState.capturedSheep += 1;
    }
  }

  return snapshot;
}

function undoSimulatedMove(snapshot) {
  gameState.pieces = snapshot.pieces;
  gameState.capturedSheep = snapshot.capturedSheep;
  gameState.currentTurn = snapshot.currentTurn;
  gameState.winner = snapshot.winner;
}

function evaluateWolfMobility() {
  return getWolfLegalMoves().length;
}

function pickRandom(items) {
  if (items.length === 0) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function getPiece(pieceId) {
  return gameState.pieces.find((piece) => piece.id === pieceId);
}

function getPieceAtNode(nodeId) {
  return gameState.pieces.find((piece) => !piece.captured && piece.nodeId === nodeId);
}

function areConnected(fromId, toId) {
  return adjacency[fromId].includes(toId);
}

function buildAdjacency(edgeList) {
  const map = Object.fromEntries(nodes.map((node) => [node.id, []]));

  edgeList.forEach(([fromId, toId]) => {
    map[fromId].push(toId);
    map[toId].push(fromId);
  });

  return map;
}

function buildEdges() {
  const edgeList = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (col < BOARD_SIZE - 1) {
        edgeList.push([idAt(row, col), idAt(row, col + 1)]);
      }

      if (row < BOARD_SIZE - 1) {
        edgeList.push([idAt(row, col), idAt(row + 1, col)]);
      }
    }
  }

  [
    [0, 0, 1, 1],
    [0, 2, 1, 1],
    [0, 2, 1, 3],
    [0, 4, 1, 3],
    [1, 1, 2, 2],
    [1, 3, 2, 2],
    [2, 2, 3, 1],
    [2, 2, 3, 3],
    [3, 1, 4, 0],
    [3, 1, 4, 2],
    [3, 3, 4, 2],
    [3, 3, 4, 4]
  ].forEach(([fromRow, fromCol, toRow, toCol]) => {
    edgeList.push([idAt(fromRow, fromCol), idAt(toRow, toCol)]);
  });

  return edgeList;
}

function idAt(row, col) {
  return `n${row * BOARD_SIZE + col}`;
}

localModeButton.addEventListener("click", startLocalGame);
singlePlayerButton.addEventListener("click", showSideSelection);
playWolfButton.addEventListener("click", () => showDifficultySelection("wolf"));
playSheepButton.addEventListener("click", () => showDifficultySelection("sheep"));
sideBackButton.addEventListener("click", showStartScreen);
easyButton.addEventListener("click", () => startSinglePlayerGame("easy"));
normalButton.addEventListener("click", () => startSinglePlayerGame("normal"));
hardButton.addEventListener("click", () => startSinglePlayerGame("hard"));
difficultyBackButton.addEventListener("click", showSideSelection);
mainMenuButton.addEventListener("click", showStartScreen);
restartButton.addEventListener("click", restartMatch);
undoButton.addEventListener("click", undoLastMove);
exportButton.addEventListener("click", exportMatchData);
exportAnalyticsButton.addEventListener("click", exportAllAnalytics);
replayButton.addEventListener("click", startReplay);
firstReplayButton.addEventListener("click", () => setReplayIndex(gameState.moveHistory.length > 0 ? 1 : 0));
previousReplayButton.addEventListener("click", () => setReplayIndex(gameState.replay.index - 1));
nextReplayButton.addEventListener("click", () => setReplayIndex(gameState.replay.index + 1));
lastReplayButton.addEventListener("click", () => setReplayIndex(gameState.moveHistory.length));
debugToggle.addEventListener("change", toggleDebugMode);
forceWolfWinButton.addEventListener("click", () => forceWin("wolf"));
forceSheepWinButton.addEventListener("click", () => forceWin("sheep"));
addCaptureButton.addEventListener("click", addDeveloperCapture);
resetAnalyticsButton.addEventListener("click", resetAnalytics);
generateTestMatchButton.addEventListener("click", generateTestMatch);
simulate10Button.addEventListener("click", () => runAISimulations(10));
simulate50Button.addEventListener("click", () => runAISimulations(50));
simulate100Button.addEventListener("click", () => runAISimulations(100));
soundToggleButton.addEventListener("click", toggleSound);
tutorialNextButton.addEventListener("click", advanceTutorial);
tutorialSkipButton.addEventListener("click", closeTutorial);
playAgainButton.addEventListener("click", restartMatch);
winMenuButton.addEventListener("click", showStartScreen);
watchReplayButton.addEventListener("click", startReplay);
document.addEventListener("click", (event) => {
  if (event.target.closest("button")) {
    playSound("button");
  }
});

updateSoundToggle();
updateAchievementsUI();
updateAnalyticsDashboard();
updateAIPerformanceUI();
showStartScreen();
showTutorialIfNeeded();
