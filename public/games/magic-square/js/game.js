(function () {
  let progress = MagicStorage.load();
  let state;
  let selectedCell = null;
  let selectedNumber = null;
  let selectedTileElement = null;
  let draggedNumber = null;
  let dragSource = null;
  let dragPreview = null;
  let suppressClick = false;
  let undoStack = [];
  let timerId;
  let bossTimerId;
  let pressureTimerId;
  let startedAt;
  let currentAssignment = null;
  let pendingBoss = null;
  const spellCooldowns = {};
  const modeConfigs = {
    gauntlet: { label: "Puzzle Gauntlet", chain: 3, size: 3, difficulty: "easy" },
    speed: { label: "Speed Trial", chain: 1, size: 4, difficulty: "medium", countdown: 180 },
    noHints: { label: "No Hint Challenge", chain: 1, size: 4, difficulty: "hard", noHints: true },
    endless: { label: "Endless Mode", chain: Infinity, size: 3, difficulty: "easy" },
    dailyElite: { label: "Daily Elite Challenge", chain: 1, size: 5, difficulty: "hard", noHints: true, dailyElite: true }
  };

  const bosses = [
    { key: "frost", name: "Frost Queen", realm: "Frostspire Peak", size: 4, difficulty: "medium", hp: 170, tone: "frost", attack: "freeze", modifier: "Glacial Lock: cells freeze between phases.", dialogue: "The northern rune towers belong to winter. Prove that order can survive the cold.", victory: "The thaw carries your lesson across the peaks." },
    { key: "chaos", name: "Chaos Wizard", realm: "Inferno Citadel", size: 4, difficulty: "hard", hp: 205, tone: "chaos", attack: "scramble", modifier: "Rune Distortion: totals and placements twist.", dialogue: "Equations are dull when they behave. Let us introduce a little chaos.", victory: "The corrupted equations fall back into balance." },
    { key: "dragon", name: "Prime Dragon", realm: "Inferno Citadel", size: 5, difficulty: "medium", hp: 245, tone: "dragon", attack: "prime", modifier: "Prime Flame: prime-number cells burn brightest.", dialogue: "Only prime flame endures. Bring me a square worthy of my hoard.", victory: "The dragon yields a radiant rune chest." },
    { key: "oracle", name: "Void Oracle", realm: "Void Citadel", size: 5, difficulty: "hard", hp: 285, tone: "oracle", attack: "illusion", modifier: "Future Veil: fog and false totals obscure the board.", dialogue: "I have seen every failed answer. Show me the future I missed.", victory: "The void releases the futures it stole." },
    { key: "storm", name: "Storm Colossus", realm: "Storm Temple", size: 5, difficulty: "hard", hp: 320, tone: "stormboss", attack: "lightning", modifier: "Thunder Seal: lightning locks runes in every phase.", dialogue: "Count beneath thunder, apprentice. The sky itself will judge you.", victory: "The storm becomes a chorus for the academy." }
  ];

  function cloneGrid(grid) {
    return grid.map((row) => row.slice());
  }

  function visibleSignature(puzzle) {
    return puzzle.givens.flat().map((value) => value || "x").join("-");
  }

  function clearSelection() {
    selectedCell = null;
    selectedNumber = null;
    selectedTileElement = null;
    draggedNumber = null;
    dragSource = null;
    if (dragPreview) dragPreview.remove();
    dragPreview = null;
    document.body.style.cursor = "";
    document.querySelectorAll(".selected, .drag-source").forEach((element) => element.classList.remove("selected", "drag-source"));
  }

  function realmWithOptions(realm, size, difficulty) {
    return {
      ...realm,
      size: Number(size || realm.size),
      difficulty: difficulty || realm.difficulty
    };
  }

  function startRealm(realm, options = {}) {
    clearSelection();
    if (!options.boss && !options.daily && !options.assignment && !options.mode && !MagicUI.isRealmUnlocked(progress, realm)) {
      MagicUI.toast(`${realm.name} unlocks at ${realm.xp} XP.`);
      return;
    }
    const nextRealm = realmWithOptions(realm, options.size, options.difficulty);
    const currentSignature = state ? visibleSignature(state.puzzle) : null;
    let puzzle = options.puzzle || MagicGenerator.makePuzzle(nextRealm.size, nextRealm.difficulty, options.seed || null);
    let attempts = 0;
    while (visibleSignature(puzzle) === currentSignature && attempts < 5000) {
      puzzle = MagicGenerator.makePuzzle(nextRealm.size, nextRealm.difficulty);
      attempts += 1;
    }
    state = {
      realm: nextRealm,
      puzzle,
      entries: cloneGrid(puzzle.givens),
      hintsUsed: 0,
      solved: false,
      moves: 0,
      lastPlaced: null,
      lastHint: null,
      wrongCells: [],
      warningCells: [],
      mistakes: 0,
      daily: !!options.daily,
      mode: options.mode || null,
      modeStep: options.modeStep || 1,
      modeCombo: options.modeCombo || 1,
      countdown: options.countdown || null,
      boss: options.boss || null,
      assignment: options.assignment || null,
      assignmentIndex: options.assignmentIndex || 0,
      playerHp: 100,
      mana: progress.spells?.mana || 100,
      combo: 0,
      bestCombo: 0,
      damageDealt: 0,
      spellsCast: 0,
      creditedCells: new Set(),
      doubleXp: false,
      shielded: false,
      freezeUntil: 0,
      frozenCells: nextRealm.modifier === "frost" || options.boss?.attack === "freeze" ? makeBossCells(puzzle.size, 2) : [],
      cursedCells: options.boss?.attack === "prime" || options.boss?.attack === "illusion" || nextRealm.modifier === "void" ? makeBossCells(puzzle.size, 3) : [],
      foggedCells: options.boss?.attack === "illusion" || nextRealm.modifier === "void" ? makeBossCells(puzzle.size, 4) : []
    };
    if (state.boss) {
      state.boss.phase = state.boss.phase || 1;
      state.boss.round = state.boss.round || 1;
      state.boss.maxHp = state.boss.maxHp || state.boss.hp || 170;
      state.boss.hp = state.boss.hp || state.boss.maxHp;
      state.boss.taunt = state.boss.taunt || state.boss.dialogue || state.boss.modifier;
      state.boss.rageLine = state.boss.rageLine || `${state.boss.name} unleashes an ultimate attack!`;
    }
    if (options.resume) {
      state.entries = cloneGrid(options.resume.entries);
      state.hintsUsed = options.resume.hintsUsed || 0;
      state.moves = options.resume.moves || 0;
      startedAt = Date.now() - (options.resume.elapsedSeconds || 0) * 1000;
    }
    if (options.battleCarry && state.boss) {
      state.playerHp = options.battleCarry.playerHp;
      state.mana = options.battleCarry.mana;
      state.combo = options.battleCarry.combo;
      state.bestCombo = options.battleCarry.bestCombo;
      state.damageDealt = options.battleCarry.damageDealt;
      state.spellsCast = options.battleCarry.spellsCast;
    }
    undoStack = [];
    if (!options.resume) startedAt = Date.now();
    clearInterval(timerId);
    clearInterval(bossTimerId);
    clearInterval(pressureTimerId);
    timerId = setInterval(updateTimer, 500);
    if (state.boss) bossTimerId = setInterval(bossPulse, state.boss.phase >= 3 ? 4300 : state.boss.phase === 2 ? 5600 : 7200);
    if (nextRealm.modifier === "storm") bossTimerId = setInterval(stormPulse, 6500);
    if (nextRealm.modifier === "pressure" || state.mode === "speed") pressureTimerId = setInterval(pressurePulse, 9000);
    if (state.frozenCells.length) setTimeout(() => {
      if (state && !state.solved) {
        state.frozenCells = [];
        renderTrial();
        MagicUI.toast("Frozen cells thawed.");
      }
    }, 14000);
    document.getElementById("realmSubtitle").textContent = `${nextRealm.name} · ${nextRealm.size}x${nextRealm.size} · ${nextRealm.difficulty}`;
    document.getElementById("trialTitle").textContent = state.mode ? `${modeConfigs[state.mode].label} ${state.modeStep}` : `${nextRealm.name} Trial`;
    document.getElementById("magicSum").textContent = puzzle.magicSum;
    document.getElementById("sizeSelect").value = String(nextRealm.size);
    document.getElementById("difficultySelect").value = nextRealm.difficulty;
    document.getElementById("sizeSelect").disabled = !!state.boss;
    document.getElementById("difficultySelect").disabled = !!state.boss;
    MagicEffects.setRealmAtmosphere(state.boss ? state.boss.tone : nextRealm.tone || "default", !!state.boss);
    MagicEffects.transition(state.boss ? "boss" : "realm");
    MagicUI.showView("trial");
    document.body.classList.toggle("boss-arena", !!state.boss);
    if (!options.skipStory) showStory(nextRealm.name, nextRealm.name, nextRealm.lore || "A new realm opens its gates to your rune craft.", true);
    renderTrial();
    updateTimer();
  }

  function renderTrial() {
    renderBoard();
    renderBank();
    renderTotals();
    renderSpellBar();
    renderBossStatus();
    document.getElementById("hintsLeft").textContent = 3 - state.hintsUsed;
    saveSnapshot();
  }

  function renderBoard() {
    const wrap = document.getElementById("boardWrap");
    const size = state.puzzle.size;
    wrap.style.setProperty("--size", size);
    wrap.innerHTML = `<div class="magic-board size-${size}">${
      state.entries.flatMap((row, r) => row.map((value, c) => {
        const locked = state.puzzle.givens[r][c] !== null;
        const student = !locked && value;
        const selected = selectedCell && selectedCell.r === r && selectedCell.c === c;
        const placed = state.lastPlaced && state.lastPlaced.r === r && state.lastPlaced.c === c;
        const hinted = state.lastHint && state.lastHint.r === r && state.lastHint.c === c;
        const wrong = state.wrongCells.some((cell) => cell.r === r && cell.c === c);
        const warning = state.warningCells.some((cell) => cell.r === r && cell.c === c);
        const cursed = state.cursedCells?.some((cell) => cell.r === r && cell.c === c);
        const fogged = state.foggedCells?.some((cell) => cell.r === r && cell.c === c) && !value;
        const frozen = state.frozenCells?.some((cell) => cell.r === r && cell.c === c);
        return `<button class="cell ${locked ? "locked" : ""} ${student ? "student" : ""} ${selected ? "selected" : ""} ${placed ? "placed" : ""} ${hinted ? "hinted" : ""} ${wrong ? "wrong" : ""} ${warning ? "warning" : ""} ${cursed ? "cursed" : ""} ${fogged ? "fogged" : ""} ${frozen ? "frozen" : ""}" data-r="${r}" data-c="${c}" ${locked ? "aria-label='Locked number'" : ""}>${fogged ? "?" : value || ""}</button>`;
      })).join("")
    }</div>`;

    wrap.querySelectorAll(".cell").forEach((cell) => {
      cell.addEventListener("click", onCellClick);
      cell.addEventListener("contextmenu", cancelSelection);
      const r = Number(cell.dataset.r);
      const c = Number(cell.dataset.c);
      if (state.puzzle.givens[r][c] === null && state.entries[r][c]) {
        cell.addEventListener("pointerdown", (event) => startRuneDrag(event, state.entries[r][c], { type: "cell", r, c }, cell));
      }
    });
  }

  function availableNumbers() {
    const used = new Map();
    state.entries.flat().forEach((value) => {
      if (value) used.set(value, (used.get(value) || 0) + 1);
    });
    return Array.from({ length: state.puzzle.size * state.puzzle.size }, (_, i) => i + 1)
      .filter((value) => !used.has(value));
  }

  function renderBank() {
    const bank = document.getElementById("numberBank");
    bank.innerHTML = availableNumbers().map((value) =>
      `<button class="bank-rune ${selectedNumber === value ? "selected" : ""}" data-value="${value}" aria-pressed="${selectedNumber === value}">${value}</button>`
    ).join("");
    bank.querySelectorAll(".bank-rune").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (suppressClick) return;
        const value = Number(button.dataset.value);
        if (selectedNumber === value) {
          clearSelection();
          renderTrial();
          return;
        }
        selectedNumber = value;
        selectedTileElement = button;
        document.body.style.cursor = "copy";
        if (selectedCell) placeNumber(selectedCell.r, selectedCell.c);
        else renderTrial();
      });
      button.addEventListener("pointerdown", (event) => startRuneDrag(event, Number(button.dataset.value), { type: "bank" }, button));
      button.addEventListener("contextmenu", cancelSelection);
    });
  }

  function pushUndo() {
    undoStack.push({
      entries: cloneGrid(state.entries),
      hintsUsed: state.hintsUsed,
      lastPlaced: state.lastPlaced ? { ...state.lastPlaced } : null,
      lastHint: state.lastHint ? { ...state.lastHint } : null
    });
    if (undoStack.length > 30) undoStack.shift();
  }

  function undoMove() {
    clearSelection();
    const previous = undoStack.pop();
    if (!previous) {
      MagicUI.toast("No move to undo.");
      return;
    }
    state.entries = cloneGrid(previous.entries);
    state.hintsUsed = previous.hintsUsed;
    state.lastPlaced = previous.lastPlaced;
    state.lastHint = previous.lastHint;
    renderTrial();
  }

  function saveSnapshot() {
    if (!state || state.solved || !startedAt) return;
    MagicStorage.saveCurrentPuzzle(progress, {
      realm: state.realm,
      puzzle: state.puzzle,
      entries: state.entries,
      hintsUsed: state.hintsUsed,
      moves: state.moves,
      elapsedSeconds: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      daily: state.daily,
      boss: state.boss,
      assignment: state.assignment,
      assignmentIndex: state.assignmentIndex,
      playerHp: state.playerHp,
      mana: state.mana,
      combo: state.combo,
      bestCombo: state.bestCombo,
      damageDealt: state.damageDealt,
      spellsCast: state.spellsCast,
      savedAt: Date.now()
    });
  }

  function makeBossCells(size, count) {
    const cells = [];
    const used = new Set();
    while (cells.length < Math.min(count, size * size)) {
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      const key = `${r}:${c}`;
      if (!used.has(key)) {
        used.add(key);
        cells.push({ r, c });
      }
    }
    return cells;
  }

  function renderSpellBar() {
    const bar = document.getElementById("spellBar");
    bar.hidden = !state.boss;
    if (!state.boss) {
      bar.innerHTML = "";
      return;
    }
    const unlocked = progress.spells?.unlocked || [];
    bar.innerHTML = `<div class="mana-chip">Mana <b>${state.mana}</b></div>` + Object.entries(MagicUI.spells).map(([key, spell]) => {
      const ready = unlocked.includes(key);
      const cooling = (spellCooldowns[key] || 0) > Date.now();
      const level = progress.spells?.levels?.[key] || 1;
      const cost = Math.max(8, spell.cost - level * 2);
      const disabled = !ready || cooling || state.mana < cost || state.solved;
      return `<button class="spell-button ${ready ? "" : "locked"} ${cooling ? "cooling" : ""}" data-spell="${key}" ${disabled ? "disabled" : ""} title="${spell.text}">
        <span>${spell.icon}</span><b>${spell.name}</b><small>${ready ? `Lv ${level} · ${cost} mana` : "Locked"}</small>
      </button>`;
    }).join("");
    bar.querySelectorAll(".spell-button").forEach((button) => {
      button.addEventListener("click", () => castSpell(button.dataset.spell));
    });
  }

  function renderBossStatus() {
    const panel = document.getElementById("bossStatus");
    const hud = document.getElementById("combatHud");
    const dialogue = document.getElementById("bossDialogue");
    panel.hidden = !state.boss;
    hud.hidden = !state.boss;
    dialogue.hidden = !state.boss;
    if (!state.boss) {
      document.body.classList.remove("boss-rage");
      MagicEffects.lowHp(false);
      return;
    }
    document.getElementById("bossPortrait").className = `boss-portrait ${state.boss.tone}`;
    document.getElementById("bossName").textContent = state.boss.name;
    document.getElementById("bossModifier").textContent = state.boss.modifier;
    document.getElementById("bossHpFill").style.width = `${Math.max(0, state.boss.hp / state.boss.maxHp * 100)}%`;
    document.getElementById("bossHpText").textContent = `${Math.max(0, state.boss.hp)} / ${state.boss.maxHp} HP`;
    document.getElementById("playerHpFill").style.width = `${Math.max(0, state.playerHp)}%`;
    document.getElementById("playerHpText").textContent = `${Math.max(0, state.playerHp)} / 100 HP`;
    document.getElementById("comboText").textContent = `x${state.combo}`;
    document.getElementById("phaseText").textContent = `Phase ${state.boss.phase}${state.boss.phase === 3 ? " · RAGE" : ""}`;
    dialogue.innerHTML = `<b>${state.boss.name}</b><span>${state.boss.taunt || state.boss.dialogue}</span>`;
    document.body.classList.toggle("boss-rage", state.boss.phase === 3);
    MagicEffects.lowHp(state.playerHp <= 28);
  }

  function createDragPreview(number, x, y) {
    dragPreview = document.createElement("div");
    dragPreview.className = "custom-drag-preview";
    dragPreview.textContent = number;
    document.body.appendChild(dragPreview);
    moveDragPreview(x, y);
  }

  function moveDragPreview(x, y) {
    if (!dragPreview) return;
    dragPreview.style.left = `${x}px`;
    dragPreview.style.top = `${y}px`;
  }

  function startRuneDrag(event, number, source, element) {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let activeDrag = false;

    function move(moveEvent) {
      const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!activeDrag && distance < 8) return;
      if (!activeDrag) {
        activeDrag = true;
        suppressClick = true;
        draggedNumber = number;
        selectedNumber = number;
        dragSource = source;
        selectedTileElement = element;
        element.classList.add("drag-source", "selected");
        document.body.style.cursor = "grabbing";
        createDragPreview(number, moveEvent.clientX, moveEvent.clientY);
      }
      moveDragPreview(moveEvent.clientX, moveEvent.clientY);
      moveEvent.preventDefault();
    }

    function end(endEvent) {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      if (!activeDrag) return;
      const target = document.elementFromPoint(endEvent.clientX, endEvent.clientY)?.closest(".cell");
      if (target) {
        const r = Number(target.dataset.r);
        const c = Number(target.dataset.c);
        if (dragSource && dragSource.type === "cell") moveRune(dragSource.r, dragSource.c, r, c);
        else placeRune(r, c, draggedNumber);
      } else {
        clearSelection();
        renderTrial();
      }
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    }

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
  }

  function lineStatus(values) {
    const filled = values.every(Boolean);
    const total = values.reduce((sum, value) => sum + (value || 0), 0);
    if (!filled) return { total, status: total > state.puzzle.magicSum ? "bad" : "open" };
    return { total, status: total === state.puzzle.magicSum ? "good" : "bad" };
  }

  function renderTotals() {
    const size = state.puzzle.size;
    const rows = state.entries.map((row, i) => [`Row ${i + 1}`, lineStatus(row)]);
    const cols = Array.from({ length: size }, (_, c) => [`Column ${c + 1}`, lineStatus(state.entries.map((row) => row[c]))]);
    const diags = [
      ["Diagonal A", lineStatus(state.entries.map((row, i) => row[i]))],
      ["Diagonal B", lineStatus(state.entries.map((row, i) => row[size - i - 1]))]
    ];
    document.getElementById("totalsList").innerHTML = [
      ["Rows", rows],
      ["Columns", cols],
      ["Diagonals", diags]
    ].map(([title, items]) => `
      <section>
        <h4>${title}</h4>
        ${items.map(([label, item]) => `<div class="total ${item.status} ${item.status === "bad" ? "pulse" : ""}"><span>${label}</span><b>${hideTotal(item) ? "?" : item.total}</b></div>`).join("")}
      </section>
    `).join("");
  }

  function hideTotal(item) {
    if (state.realm.modifier !== "shadow") return false;
    const filled = state.entries.flat().filter(Boolean).length;
    return filled < Math.ceil(state.puzzle.size * state.puzzle.size * 0.45) && item.status !== "good";
  }

  function onCellClick(event) {
    event.stopPropagation();
    if (suppressClick) return;
    const r = Number(event.currentTarget.dataset.r);
    const c = Number(event.currentTarget.dataset.c);
    if (state.puzzle.givens[r][c] !== null) {
      if (selectedNumber) invalidMove("Locked runes cannot be changed.");
      return;
    }
    if (state.frozenCells?.some((cell) => cell.r === r && cell.c === c)) {
      invalidMove("That cell is frozen for a moment.");
      return;
    }
    if (selectedNumber) {
      placeRune(r, c, selectedNumber);
      return;
    }
    if (state.entries[r][c]) {
      removeRune(r, c);
      return;
    }
    if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
      clearSelection();
      renderTrial();
      return;
    }
    selectedCell = { r, c };
    renderBoard();
  }

  function cancelSelection(event) {
    event.preventDefault();
    clearSelection();
    renderTrial();
  }

  function removeNumberFromOtherCells(number, targetR, targetC) {
    state.entries.forEach((row, r) => row.forEach((value, c) => {
      if (value === number && (r !== targetR || c !== targetC) && state.puzzle.givens[r][c] === null) {
        state.entries[r][c] = null;
      }
    }));
  }

  function invalidMove(message) {
    clearSelection();
    state.mistakes += 1;
    if (state.boss) receiveBossDamage(7 + state.boss.phase * 2, message);
    MagicUI.toast(message);
    renderTrial();
  }

  function dealBossDamage(amount, label) {
    if (!state.boss || state.solved) return;
    const dealt = Math.min(amount, Math.max(0, state.boss.hp - 1));
    state.boss.hp -= dealt;
    state.damageDealt += dealt;
    if (dealt > 0) combatText(`-${dealt}`, "damage");
    if (dealt > 0) MagicEffects.impact("boss-hit", amount >= 20 ? 2 : 1);
    if (label) state.boss.taunt = label;
    updateBossPhase();
  }

  function receiveBossDamage(amount, message) {
    if (!state.boss) return;
    state.combo = 0;
    if (state.shielded) {
      state.shielded = false;
      combatText("BLOCK", "shield");
      MagicEffects.impact("shield", 1);
      MagicUI.toast("Shield absorbed the attack.");
      return;
    }
    state.playerHp = Math.max(0, state.playerHp - amount);
    combatText(`-${amount} HP`, "hurt");
    MagicEffects.lowHp(state.playerHp <= 28);
    MagicEffects.impact("hurt", amount >= 12 ? 2 : 1);
    state.boss.taunt = message;
    MagicEffects.tone(130, 0.15, progress.muted);
    if (state.playerHp <= 0) failBossBattle();
  }

  function combatText(text, tone) {
    const node = document.createElement("i");
    node.className = `combat-text ${tone}`;
    node.textContent = text;
    document.querySelector(".board-panel")?.appendChild(node);
    setTimeout(() => node.remove(), 950);
  }

  function updateBossPhase() {
    if (!state.boss) return;
    const ratio = state.boss.hp / state.boss.maxHp;
    const nextPhase = ratio <= 0.34 ? 3 : ratio <= 0.67 ? 2 : 1;
    if (nextPhase <= state.boss.phase) return;
    state.boss.phase = nextPhase;
    state.boss.taunt = nextPhase === 3 ? state.boss.rageLine : `Phase ${nextPhase}: ${state.boss.modifier}`;
    MagicUI.toast(`${state.boss.name} enters Phase ${nextPhase}!`);
    document.body.classList.add("arena-impact");
    setTimeout(() => document.body.classList.remove("arena-impact"), 500);
    MagicEffects.phase(nextPhase);
    applyBossAttack(true);
    clearInterval(bossTimerId);
    bossTimerId = setInterval(bossPulse, nextPhase === 3 ? 4300 : 5600);
  }

  function correctCombatPlacement(r, c, number) {
    if (!state.boss || number !== state.puzzle.solution[r][c]) return;
    const key = `${r}:${c}`;
    if (state.creditedCells.has(key)) return;
    state.creditedCells.add(key);
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.mana = Math.min(100, state.mana + 2 + Math.floor(state.combo / 3));
    const damage = 3 + Math.min(7, state.combo);
    dealBossDamage(damage, state.combo >= 4 ? "Your combo burns brightly. It will not last." : null);
    if (state.combo >= 3) {
      combatText(`COMBO x${state.combo}`, "combo");
      MagicEffects.combo(state.combo);
    }
  }

  function placeRune(r, c, number) {
    if (!number) {
      clearSelection();
      renderTrial();
      return;
    }
    if (state.puzzle.givens[r][c] !== null) {
      invalidMove("Locked runes cannot be changed.");
      return;
    }
    if (state.frozenCells?.some((cell) => cell.r === r && cell.c === c)) {
      invalidMove("That cell is frozen for a moment.");
      return;
    }
    pushUndo();
    removeNumberFromOtherCells(number, r, c);
    state.entries[r][c] = number;
    state.lastPlaced = { r, c };
    state.lastHint = null;
    state.wrongCells = [];
    state.warningCells = [];
    state.moves += 1;
    if (state.boss && number === state.puzzle.solution[r][c]) correctCombatPlacement(r, c, number);
    if (state.boss && number !== state.puzzle.solution[r][c]) {
      state.mistakes += 1;
      receiveBossDamage(6 + state.boss.phase * 3, "A false rune opens your guard.");
    }
    if (state.boss && state.cursedCells.some((cell) => cell.r === r && cell.c === c) && number !== state.puzzle.solution[r][c]) {
      if (state.shielded) {
        state.shielded = false;
        MagicUI.toast("Shield absorbed the curse.");
      } else {
        receiveBossDamage(8, "The curse strikes through the rune.");
        state.warningCells = [{ r, c }];
        MagicUI.toast("A cursed cell resists that rune.");
      }
    }
    const placedNumber = number;
    const targetCell = document.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    const source = selectedTileElement && document.body.contains(selectedTileElement) ? selectedTileElement : targetCell;
    clearSelection();
    MagicEffects.tone(520 + placedNumber * 18, 0.09, progress.muted);
    if (source) {
      const rect = source.getBoundingClientRect();
      MagicEffects.burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    renderTrial();
    if (isPuzzleSolved()) winPuzzle();
  }

  function placeNumber(r, c) {
    placeRune(r, c, selectedNumber);
  }

  function removeRune(r, c) {
    if (state.puzzle.givens[r][c] !== null || !state.entries[r][c]) return;
    pushUndo();
    state.entries[r][c] = null;
    state.lastPlaced = null;
    state.lastHint = null;
    state.wrongCells = [];
    state.warningCells = [];
    state.moves += 1;
    clearSelection();
    renderTrial();
    MagicEffects.tone(260, 0.08, progress.muted);
  }

  function moveRune(fromR, fromC, toR, toC) {
    if (state.puzzle.givens[fromR][fromC] !== null || !state.entries[fromR][fromC]) {
      invalidMove("Only your placed runes can move.");
      return;
    }
    if (state.puzzle.givens[toR][toC] !== null) {
      invalidMove("Locked runes cannot be changed.");
      return;
    }
    if (state.frozenCells?.some((cell) => cell.r === toR && cell.c === toC)) {
      invalidMove("That cell is frozen for a moment.");
      return;
    }
    const number = state.entries[fromR][fromC];
    pushUndo();
    state.entries[fromR][fromC] = null;
    removeNumberFromOtherCells(number, toR, toC);
    state.entries[toR][toC] = number;
    state.lastPlaced = { r: toR, c: toC };
    state.lastHint = null;
    state.wrongCells = [];
    state.warningCells = [];
    state.moves += 1;
    if (state.boss && number === state.puzzle.solution[toR][toC]) correctCombatPlacement(toR, toC, number);
    if (state.boss && number !== state.puzzle.solution[toR][toC]) {
      state.mistakes += 1;
      receiveBossDamage(6 + state.boss.phase * 3, "The displaced rune breaks your rhythm.");
    }
    clearSelection();
    renderTrial();
    MagicEffects.tone(520 + number * 18, 0.09, progress.muted);
    if (isPuzzleSolved()) winPuzzle();
  }

  function clearBoard() {
    clearSelection();
    pushUndo();
    state.entries = cloneGrid(state.puzzle.givens);
    state.lastPlaced = null;
    state.lastHint = null;
    state.wrongCells = [];
    state.warningCells = [];
    state.moves += 1;
    renderTrial();
    MagicUI.toast("Board cleared.");
  }

  function resetPuzzle() {
    clearSelection();
    pushUndo();
    state.entries = cloneGrid(state.puzzle.givens);
    state.hintsUsed = 0;
    state.solved = false;
    state.moves = 0;
    state.lastPlaced = null;
    state.lastHint = null;
    state.wrongCells = [];
    state.warningCells = [];
    startedAt = Date.now();
    renderTrial();
    MagicUI.toast("Trial reset.");
  }

  function newPuzzle() {
    if (!state.boss) {
      startRealm(state.realm);
      return;
    }
    const carry = {
      playerHp: state.playerHp,
      mana: state.mana,
      combo: 0,
      bestCombo: state.bestCombo,
      damageDealt: state.damageDealt,
      spellsCast: state.spellsCast
    };
    const puzzle = MagicGenerator.makePuzzle(state.boss.size, state.boss.difficulty, `${state.boss.key}-reroll-${Date.now()}`);
    startRealm(state.realm, { puzzle, boss: state.boss, battleCarry: carry, skipStory: true });
    MagicUI.toast("The arena forms a new square.");
  }

  function duplicateValues() {
    const counts = new Map();
    state.entries.flat().forEach((value) => {
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
  }

  function cellsForLine(type, index) {
    const size = state.puzzle.size;
    if (type === "row") return Array.from({ length: size }, (_, c) => ({ r: index, c }));
    if (type === "col") return Array.from({ length: size }, (_, r) => ({ r, c: index }));
    if (type === "diagA") return Array.from({ length: size }, (_, i) => ({ r: i, c: i }));
    return Array.from({ length: size }, (_, i) => ({ r: i, c: size - i - 1 }));
  }

  function smartHintMessage(level) {
    state.warningCells = [];
    const duplicates = duplicateValues();
    if (duplicates.length) return `You already used number ${duplicates[0]}. Each rune can appear only once.`;
    const target = state.puzzle.magicSum;
    const size = state.puzzle.size;
    for (let r = 0; r < size; r += 1) {
      const row = state.entries[r];
      const sum = row.reduce((a, b) => a + (b || 0), 0);
      const blanks = row.filter((value) => !value).length;
      if (sum > target) {
        state.warningCells = cellsForLine("row", r);
        return "This row exceeds the magic sum.";
      }
      if (blanks && level === 1) {
        state.warningCells = cellsForLine("row", r);
        return `Row ${r + 1} needs ${target - sum} more.`;
      }
      if (!blanks && sum === target) return `Row ${r + 1} is complete and correct.`;
    }
    for (let c = 0; c < size; c += 1) {
      const col = state.entries.map((row) => row[c]);
      const sum = col.reduce((a, b) => a + (b || 0), 0);
      if (sum > target) {
        state.warningCells = cellsForLine("col", c);
        return `Column ${c + 1} is too high.`;
      }
      if (level >= 2 && col.some((value) => !value)) {
        state.warningCells = cellsForLine("col", c);
        return `Column ${c + 1} needs ${target - sum} more.`;
      }
    }
    state.warningCells = cellsForLine(level >= 2 ? "diagB" : "diagA", 0);
    return level >= 2 ? "Try checking the diagonal totals." : "Look for the row with the fewest empty squares.";
  }

  function giveHint() {
    if ((state.assignment && !state.assignment.hintsAllowed) || modeConfigs[state.mode]?.noHints) {
      MagicUI.toast("Hints are disabled for this challenge.");
      return;
    }
    if (state.hintsUsed >= 3) {
      MagicUI.toast("No hints left for this trial.");
      return;
    }
    const candidates = [];
    state.entries.forEach((row, r) => row.forEach((value, c) => {
      if (state.puzzle.givens[r][c] === null && value !== state.puzzle.solution[r][c]) candidates.push({ r, c });
    }));
    if (!candidates.length) return;
    clearSelection();
    pushUndo();
    state.wrongCells = [];
    if (state.hintsUsed < 2) {
      state.hintsUsed += 1;
      state.moves += 1;
      MagicUI.toast(smartHintMessage(state.hintsUsed));
      MagicEffects.tone(700, 0.1, progress.muted);
      renderTrial();
      return;
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    state.entries[pick.r][pick.c] = state.puzzle.solution[pick.r][pick.c];
    state.lastPlaced = null;
    state.lastHint = pick;
    state.warningCells = [pick];
    state.hintsUsed += 1;
    state.moves += 1;
    MagicEffects.tone(880, 0.14, progress.muted);
    renderTrial();
    if (isPuzzleSolved()) winPuzzle();
  }

  function castSpell(key) {
    const spell = MagicUI.spells[key];
    if (!spell || state.solved) return;
    if ((spellCooldowns[key] || 0) > Date.now()) {
      MagicUI.toast(`${spell.name} is recharging.`);
      return;
    }
    const level = progress.spells?.levels?.[key] || 1;
    const cost = Math.max(8, spell.cost - level * 2);
    if (state.mana < cost) {
      MagicUI.toast("Not enough mana.");
      return;
    }
    clearSelection();
    state.mana -= cost;
    spellCooldowns[key] = Date.now() + Math.max(5000, 13000 - level * 1800);
    if (state.boss) state.spellsCast += 1;
    MagicEffects.spell(key, document.querySelector(`.spell-button[data-spell="${key}"]`));
    if (key === "fireball") {
      if (state.boss) {
        const bonus = state.boss.key === "frost" ? 10 : state.boss.key === "dragon" ? -4 : 0;
        dealBossDamage(16 + level * 6 + bonus, "Flame tests my defenses.");
        combatText("FIREBALL", "spell");
      } else {
        MagicUI.toast("Fireball is saved for boss encounters.");
      }
    }
    if (key === "blast") {
      if (state.boss) {
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        dealBossDamage(12 + level * 5, "Arcane force cracks the arena.");
        combatText("ARCANE BLAST", "spell");
      }
    }
    if (key === "reveal") revealSpell();
    if (key === "freeze") {
      const freezeMs = 17000 + level * 3000;
      state.freezeUntil = Date.now() + freezeMs;
      startedAt += freezeMs;
      MagicUI.toast(`Time is frozen for ${Math.round(freezeMs / 1000)} seconds.`);
    }
    if (key === "purify") {
      state.cursedCells = [];
      state.foggedCells = [];
      purifySpell();
    }
    if (key === "double") {
      state.doubleXp = true;
      MagicUI.toast("Double XP primed for this trial.");
    }
    if (key === "shield") {
      state.shielded = true;
      MagicUI.toast("Shield will block the next boss curse.");
    }
    if (key === "surge") {
      state.mana = Math.min(100, state.mana + 32 + level * 8);
      MagicUI.toast("Mana surges through your spell slots.");
      combatText("+MANA", "shield");
      MagicEffects.mana();
    }
    MagicEffects.tone(760, 0.12, progress.muted);
    renderTrial();
  }

  function revealSpell() {
    const candidates = [];
    state.entries.forEach((row, r) => row.forEach((value, c) => {
      if (state.puzzle.givens[r][c] === null && value !== state.puzzle.solution[r][c]) candidates.push({ r, c });
    }));
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (!pick) return;
    pushUndo();
    state.entries[pick.r][pick.c] = state.puzzle.solution[pick.r][pick.c];
    if ((progress.spells?.levels?.reveal || 1) >= 3) {
      const second = candidates.find((cell) => cell !== pick);
      if (second) state.entries[second.r][second.c] = state.puzzle.solution[second.r][second.c];
    }
    state.lastHint = pick;
    state.warningCells = [pick];
    MagicUI.toast("Reveal Rune placed one correct number.");
  }

  function purifySpell() {
    const size = state.puzzle.size;
    for (let r = 0; r < size; r += 1) {
      const row = state.entries[r];
      if (row.some((value, c) => value && value !== state.puzzle.solution[r][c])) {
        state.warningCells = cellsForLine("row", r);
        MagicUI.toast(`Purify Row highlights row ${r + 1}.`);
        return;
      }
    }
    state.warningCells = cellsForLine("row", Math.floor(Math.random() * size));
    MagicUI.toast("Purify Row found no wrong runes. Keep balancing.");
  }

  function isCompletelyFilled() {
    return state.entries.flat().every(Boolean);
  }

  function uniqueNumbersPresent() {
    const values = state.entries.flat();
    return new Set(values).size === state.puzzle.size * state.puzzle.size;
  }

  function isPuzzleSolved() {
    if (!isCompletelyFilled() || !uniqueNumbersPresent()) return false;
    const size = state.puzzle.size;
    const target = state.puzzle.magicSum;
    const rowsOk = state.entries.every((row) => row.reduce((sum, value) => sum + value, 0) === target);
    const colsOk = state.entries.every((_, c) => state.entries.reduce((sum, row) => sum + row[c], 0) === target);
    const diagA = state.entries.reduce((sum, row, i) => sum + row[i], 0) === target;
    const diagB = state.entries.reduce((sum, row, i) => sum + row[size - i - 1], 0) === target;
    return rowsOk && colsOk && diagA && diagB;
  }

  function findWrongCells() {
    const wrong = [];
    state.entries.forEach((row, r) => row.forEach((value, c) => {
      if (value && state.puzzle.givens[r][c] === null && value !== state.puzzle.solution[r][c]) {
        wrong.push({ r, c });
      }
    }));
    return wrong;
  }

  function checkAnswer() {
    clearSelection();
    state.wrongCells = [];
    if (!isCompletelyFilled()) {
      state.warningCells = [];
      renderTrial();
      MagicUI.toast("Some squares are still empty.");
      return;
    }
    if (!isPuzzleSolved()) {
      state.wrongCells = findWrongCells();
      state.warningCells = state.wrongCells;
      if (state.boss) {
        state.mistakes += 1;
        receiveBossDamage(10 + state.boss.phase * 3, "An unbalanced square gives me strength.");
      }
      renderTrial();
      MagicUI.toast(state.wrongCells.length ? "Some runes are disrupting the square." : "A total is too low or too high. Check the glowing totals.");
      MagicEffects.tone(180, 0.16, progress.muted);
      return;
    }
    winPuzzle();
  }

  function celebrateWin() {
    const count = progress.settings?.reducedMotion ? 8 : Math.max(10, Math.round(36 * ((progress.settings?.particleIntensity ?? 75) / 100)));
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti";
      piece.style.left = `${8 + Math.random() * 84}vw`;
      piece.style.setProperty("--x", `${-80 + Math.random() * 160}px`);
      piece.style.setProperty("--r", `${Math.random() * 540}deg`);
      piece.style.animationDelay = `${Math.random() * 0.28}s`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1500);
    }
    for (let i = 0; i < Math.max(5, Math.round(16 * ((progress.settings?.particleIntensity ?? 75) / 100))); i += 1) {
      const xp = document.createElement("i");
      xp.className = "xp-rain";
      xp.textContent = "+XP";
      xp.style.left = `${12 + Math.random() * 76}vw`;
      xp.style.animationDelay = `${Math.random() * 0.45}s`;
      document.body.appendChild(xp);
      setTimeout(() => xp.remove(), 1700);
    }
    MagicEffects.reward();
  }

  function winPuzzle() {
    if (state.solved) {
      const dialog = document.getElementById("winDialog");
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (state.boss && state.boss.hp > 0) {
      completeBossRound();
      return;
    }
    state.solved = true;
    clearInterval(timerId);
    clearInterval(bossTimerId);
    clearInterval(pressureTimerId);
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    if (state.boss) state.boss.hp = 0;
    const reward = MagicStorage.addWin(progress, {
      size: state.puzzle.size,
      hintsUsed: state.hintsUsed,
      seconds,
      daily: state.daily,
      doubleXp: state.doubleXp,
      boss: state.boss?.key,
      bossName: state.boss?.name,
      damageDealt: state.damageDealt,
      battleCombo: state.bestCombo,
      spellsCast: state.spellsCast,
      mode: state.mode,
      combo: state.modeCombo,
      mistakes: state.mistakes
    });
    if (state.assignment) {
      MagicStorage.recordAssignmentResult(progress, {
        student: document.getElementById("studentNameInput").value.trim() || "Local Student",
        assignmentId: state.assignment.id,
        assignmentTitle: state.assignment.title,
        puzzleNumber: state.assignmentIndex + 1,
        puzzleCount: state.assignment.count,
        size: state.assignment.size,
        difficulty: state.assignment.difficulty,
        completed: true,
        time: seconds,
        moves: state.moves,
        hintsUsed: state.hintsUsed,
        score: Math.max(0, reward.earnedStars * 100 - state.hintsUsed * 10),
        date: new Date().toISOString()
      });
      renderTeacherTools();
    }
    unlockRealms();
    MagicUI.renderProgress(progress);
    MagicUI.renderRealms(startRealm, progress);
    if (state.boss) unlockNextBoss(state.boss.key);
    document.getElementById("winTitle").textContent = state.boss ? `${state.boss.name} Defeated!` : `${reward.earnedStars} Star${reward.earnedStars === 1 ? "" : "s"} Earned!`;
    document.getElementById("winStars").textContent = "★".repeat(reward.earnedStars);
    const modeBonus = state.mode ? ` · ${modeConfigs[state.mode].label} combo x${state.modeCombo}` : "";
    document.getElementById("winSummary").textContent = state.boss
      ? `${state.boss.victory} Victory in ${MagicUI.secondsToClock(seconds)} · ${state.moves} moves · +${reward.earnedXp} XP.`
      : state.assignment
      ? `${state.assignment.title}: puzzle ${state.assignmentIndex + 1}/${state.assignment.count} solved in ${MagicUI.secondsToClock(seconds)}.`
      : `Solved in ${MagicUI.secondsToClock(seconds)} · ${state.moves} moves · +${reward.earnedXp} XP${modeBonus}`;
    const rareDrop = Math.random() < (progress.companions?.active === "tinyDragon" ? 0.35 : 0.18);
    if (rareDrop) {
      progress.badges = progress.badges || [];
      if (!progress.badges.includes("Rare Rune Drop")) progress.badges.push("Rare Rune Drop");
      MagicStorage.save(progress);
    }
    document.getElementById("winStats").innerHTML = `
      <span>Time <b>${MagicUI.secondsToClock(seconds)}</b></span>
      <span>Hints <b>${state.hintsUsed}</b></span>
      <span>Accuracy <b>${state.wrongCells.length ? "Needs focus" : "Perfect"}</b></span>
      <span>Combo <b>${state.mode ? `x${state.modeCombo}` : state.hintsUsed === 0 ? "No-hint" : "Guided"}</b></span>
      ${state.mode ? `<span>Mode Bonus <b>${modeConfigs[state.mode].label}</b></span>` : ""}
      ${state.boss ? `<span>Damage <b>${state.damageDealt}</b></span><span>Spells <b>${state.spellsCast}</b></span>` : ""}
      ${rareDrop ? "<span>Rare Drop <b>Rune Badge</b></span>" : ""}
    `;
    document.getElementById("nextRealmButton").textContent = state.assignment
      ? (state.assignmentIndex + 1 < state.assignment.count ? "Next Puzzle" : "Finish Assignment")
      : state.mode ? nextModeLabel() : "Next Realm";
    document.getElementById("winDialog").showModal();
    celebrateWin();
    MagicEffects.tone(660, 0.12, progress.muted);
    setTimeout(() => MagicEffects.tone(880, 0.16, progress.muted), 120);
  }

  function completeBossRound() {
    clearInterval(timerId);
    clearInterval(bossTimerId);
    clearInterval(pressureTimerId);
    const finisher = 28 + state.combo * 4 + (state.hintsUsed === 0 ? 12 : 0);
    const dealt = Math.min(finisher, state.boss.hp);
    state.boss.hp -= dealt;
    state.damageDealt += dealt;
    combatText(`-${dealt} ROUND`, "damage");
    if (state.boss.hp <= 0) {
      winPuzzle();
      return;
    }
    updateBossPhase();
    if (state.solved) return;
    state.boss.round += 1;
    state.boss.taunt = state.boss.phase >= 3 ? state.boss.rageLine : "Another square rises. Balance it, if you can.";
    const carry = {
      playerHp: Math.min(100, state.playerHp + 8),
      mana: Math.min(100, state.mana + 18),
      combo: state.combo,
      bestCombo: state.bestCombo,
      damageDealt: state.damageDealt,
      spellsCast: state.spellsCast
    };
    MagicUI.toast(`${state.boss.name} endures. Round ${state.boss.round} begins.`);
    const puzzle = MagicGenerator.makePuzzle(state.boss.size, state.boss.difficulty, `${state.boss.key}-round-${state.boss.round}-${Date.now()}`);
    startRealm({
      name: `${state.boss.name} Arena`,
      size: state.boss.size,
      difficulty: state.boss.difficulty,
      tone: state.boss.tone,
      modifier: state.boss.attack
    }, { puzzle, boss: state.boss, battleCarry: carry, skipStory: true });
  }

  function unlockNextBoss(key) {
    const index = bosses.findIndex((boss) => boss.key === key);
    const next = bosses[index + 1];
    if (next && !progress.unlockedBosses.includes(next.key)) {
      progress.unlockedBosses.push(next.key);
      if (!progress.badges.includes(`${next.name} Unlocked`)) progress.badges.push(`${next.name} Unlocked`);
      MagicStorage.save(progress);
      MagicEffects.reward();
      MagicEffects.tone(980, 0.22, progress.muted);
    }
    renderBossRoster();
  }

  function updateTimer() {
    if (!startedAt) return;
    const frozen = state?.freezeUntil > Date.now();
    if (frozen) {
      document.getElementById("timer").textContent = "Frozen";
      return;
    }
    if (state?.countdown) {
      const remaining = Math.max(0, state.countdown - Math.floor((Date.now() - startedAt) / 1000));
      document.getElementById("timer").textContent = `⏱ ${MagicUI.secondsToClock(remaining)}`;
      if (remaining <= 0 && !state.solved) checkAnswer();
      return;
    }
    document.getElementById("timer").textContent = MagicUI.secondsToClock(Math.floor((Date.now() - startedAt) / 1000));
  }

  function bossPulse() {
    if (!state?.boss || state.solved || state.freezeUntil > Date.now()) return;
    if (state.shielded) {
      state.shielded = false;
      MagicUI.toast("Shield blocked a boss curse.");
      renderTrial();
      return;
    }
    applyBossAttack(false);
    renderTrial();
  }

  function applyBossAttack(phaseShift) {
    if (!state?.boss || state.solved) return;
    const attack = state.boss.attack;
    const count = state.boss.phase + (phaseShift ? 1 : 0);
    if (attack === "freeze" || attack === "lightning") {
      state.frozenCells = makeBossCells(state.puzzle.size, Math.min(4, count + 1));
      state.boss.taunt = attack === "freeze" ? "Kneel beneath the blizzard." : "Thunder seals your runes.";
    }
    if (attack === "scramble") {
      state.warningCells = cellsForLine("row", Math.floor(Math.random() * state.puzzle.size));
      state.boss.taunt = "The totals tremble under chaos.";
    }
    if (attack === "prime") {
      state.cursedCells = [];
      state.puzzle.solution.forEach((row, r) => row.forEach((value, c) => {
        if (isPrime(value) && state.cursedCells.length < count + 1) state.cursedCells.push({ r, c });
      }));
      state.boss.taunt = "Prime flame marks its chosen cells.";
    }
    if (attack === "illusion") {
      state.foggedCells = makeBossCells(state.puzzle.size, Math.min(7, count + 3));
      state.cursedCells = makeBossCells(state.puzzle.size, Math.min(4, count));
      state.boss.taunt = "Can you trust the square you see?";
    }
    receiveBossDamage(4 + state.boss.phase * 3, state.boss.taunt);
  }

  function isPrime(number) {
    if (number < 2) return false;
    for (let divisor = 2; divisor <= Math.sqrt(number); divisor += 1) {
      if (number % divisor === 0) return false;
    }
    return true;
  }

  function failBossBattle() {
    if (!state?.boss || state.solved) return;
    state.solved = true;
    clearSelection();
    clearInterval(timerId);
    clearInterval(bossTimerId);
    clearInterval(pressureTimerId);
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    const partialXp = Math.max(10, Math.floor(state.damageDealt / 5));
    MagicStorage.recordBossFailure(progress, {
      bossName: state.boss.name,
      seconds,
      damageDealt: state.damageDealt,
      bestCombo: state.bestCombo,
      spellsCast: state.spellsCast,
      partialXp
    });
    MagicUI.renderProgress(progress);
    document.getElementById("defeatSummary").textContent = `${state.boss.name} prevailed. You dealt ${state.damageDealt} damage and gained ${partialXp} practice XP.`;
    document.getElementById("defeatDialog").showModal();
  }

  function pressurePulse() {
    if (!state || state.solved || state.freezeUntil > Date.now()) return;
    const size = state.puzzle.size;
    state.warningCells = cellsForLine("row", Math.floor(Math.random() * size));
    MagicUI.toast(state.realm.modifier === "pressure" ? "The citadel heat presses the timer." : "Speed Trial pressure rises.");
    renderTrial();
  }

  function stormPulse() {
    if (!state || state.solved) return;
    state.warningCells = makeBossCells(state.puzzle.size, 2);
    MagicUI.toast("Lightning flashes across the temple. Check the glowing lines.");
    renderTrial();
  }

  function unlockRealms() {
    const before = new Set(progress.unlockedRealms || []);
    progress.unlockedRealms = MagicUI.realms.filter((realm) => MagicUI.isRealmUnlocked(progress, realm)).map((realm) => realm.name);
    const unlocked = progress.unlockedRealms.find((name) => !before.has(name));
    if (unlocked) showStory("Realm Unlocked", unlocked, "A new floating island lights up on the academy map.", true);
    MagicStorage.save(progress);
  }

  function startDailyChallenge() {
    const today = MagicStorage.todayKey();
    const puzzle = MagicGenerator.makePuzzle(4, "medium", today);
    startRealm({ name: "Daily Challenge", size: 4, difficulty: "medium", icon: "☀", tone: "gold" }, { puzzle, daily: true, seed: today });
  }

  function startDailyElite() {
    const today = MagicStorage.todayKey();
    if (progress.modes?.dailyEliteDate === today) {
      MagicUI.toast("Daily Elite completed today. Come back tomorrow.");
      return;
    }
    const puzzle = MagicGenerator.makePuzzle(5, "hard", `elite-${today}`);
    startRealm({ name: "Daily Elite", size: 5, difficulty: "hard", icon: "✹", tone: "void", modifier: "void" }, {
      puzzle,
      mode: "dailyElite",
      countdown: 420,
      skipStory: true
    });
  }

  function startMode(mode) {
    const config = modeConfigs[mode];
    if (!config) return;
    const difficulty = config.difficulty;
    const size = config.size;
    const realm = {
      name: config.label,
      size,
      difficulty,
      icon: "◆",
      tone: mode === "speed" ? "storm" : mode === "endless" ? "celestial" : mode === "noHints" ? "shadow" : "emerald",
      modifier: mode === "speed" ? "pressure" : mode === "noHints" ? "shadow" : mode === "endless" ? "celestial" : "wilds",
      lore: `${config.label} keeps the magic-square rules but changes the pressure.`
    };
    startRealm(realm, { mode, modeStep: 1, modeCombo: 1, countdown: config.countdown || null, skipStory: true });
  }

  function playAgain() {
    document.getElementById("winDialog").close();
    document.getElementById("nextRealmButton").textContent = "Next Realm";
    if (state.boss) {
      startBossBattle(bosses.find((boss) => boss.key === state.boss.key));
      return;
    }
    startRealm(state.realm);
  }

  function nextRealm() {
    if (state.assignment) {
      nextAssignmentPuzzle();
      return;
    }
    if (state.mode) {
      nextModePuzzle();
      return;
    }
    document.getElementById("winDialog").close();
    document.getElementById("nextRealmButton").textContent = "Next Realm";
    if (state.boss) {
      document.body.classList.remove("boss-arena", "boss-rage");
      MagicUI.showView("world");
      return;
    }
    const index = Math.max(0, MagicUI.realms.findIndex((realm) => realm.name === state.realm.name));
    startRealm(MagicUI.realms[(index + 1) % MagicUI.realms.length]);
  }

  function nextModeLabel() {
    const config = modeConfigs[state.mode];
    if (!config) return "Next Realm";
    if (state.mode === "endless") return "Continue Endless";
    return state.modeStep < config.chain ? "Next Challenge" : "Return to Map";
  }

  function nextModePuzzle() {
    const config = modeConfigs[state.mode];
    document.getElementById("winDialog").close();
    document.getElementById("nextRealmButton").textContent = "Next Realm";
    if (!config || (state.mode !== "endless" && state.modeStep >= config.chain)) {
      MagicUI.showView("world");
      MagicUI.toast(`${config?.label || "Challenge"} complete.`);
      return;
    }
    const nextStep = state.modeStep + 1;
    const size = state.mode === "endless" ? (nextStep > 4 ? 5 : nextStep > 2 ? 4 : 3) : Math.min(5, config.size + (nextStep > 2 ? 1 : 0));
    const difficulty = nextStep >= 3 ? "hard" : nextStep === 2 ? "medium" : config.difficulty;
    startRealm({
      ...state.realm,
      size,
      difficulty,
      name: modeConfigs[state.mode].label
    }, {
      mode: state.mode,
      modeStep: nextStep,
      modeCombo: state.modeCombo + 1,
      countdown: state.mode === "speed" ? Math.max(80, 190 - nextStep * 20) : null,
      skipStory: true
    });
  }

  function renderBossRoster() {
    const roster = document.getElementById("bossRoster");
    roster.innerHTML = bosses.map((boss) => {
      const unlocked = progress.unlockedBosses.includes(boss.key);
      const defeated = !!progress.bossVictories[boss.key];
      return `<button class="boss-pick ${boss.tone} ${defeated ? "defeated" : ""}" data-boss="${boss.key}" ${unlocked ? "" : "disabled"}>
        <i class="boss-portrait ${boss.tone}"></i>
        <span>${boss.name}</span>
        <small>${defeated ? "Defeated · Rematch" : unlocked ? `${boss.hp} HP` : "Locked"}</small>
      </button>`;
    }).join("");
    roster.querySelectorAll("[data-boss]").forEach((button) => {
      button.addEventListener("click", () => openBossIntro(button.dataset.boss));
    });
  }

  function openBossIntro(key) {
    const config = bosses.find((boss) => boss.key === key);
    if (!config || !progress.unlockedBosses.includes(key)) return;
    pendingBoss = config;
    document.getElementById("introPortrait").className = `boss-portrait large ${config.tone}`;
    document.getElementById("introBossName").textContent = config.name;
    document.getElementById("introDialogue").textContent = config.dialogue;
    MagicEffects.transition("boss");
    MagicEffects.setRealmAtmosphere(config.tone, true);
    document.getElementById("bossIntroDialog").showModal();
  }

  function startBossBattle(config = pendingBoss) {
    if (!config) return;
    document.getElementById("bossIntroDialog").close();
    const boss = {
      ...config,
      hp: config.hp,
      maxHp: config.hp,
      phase: 1,
      round: 1,
      rageLine: `${config.name} unleashes an ultimate attack!`,
      taunt: config.dialogue
    };
    MagicStorage.startBossEncounter(progress);
    const puzzle = MagicGenerator.makePuzzle(config.size, config.difficulty, `boss-${config.key}-${Date.now()}`);
    startRealm({
      name: `${config.name} Arena`,
      size: config.size,
      difficulty: config.difficulty,
      tone: config.tone,
      modifier: config.attack,
      lore: config.dialogue
    }, { puzzle, boss, skipStory: true });
    MagicEffects.phase(1);
    MagicEffects.tone(92, 0.32, progress.muted);
  }

  function showStory(eyebrow, title, text, subtle = false) {
    const dialog = document.getElementById("storyDialog");
    if (!dialog || dialog.open) return;
    if (subtle && progress.storySeen && !title.includes("Unlocked") && !title.includes("Battle")) return;
    document.getElementById("storyEyebrow").textContent = eyebrow;
    document.getElementById("storyTitle").textContent = title;
    document.getElementById("storyText").textContent = text;
    dialog.showModal();
  }

  function encodeChallenge(data) {
    const json = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function decodeChallenge(code) {
    const padded = code.trim().replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(code.trim().length / 4) * 4, "=");
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  }

  function assignmentSeeds(id, count) {
    return Array.from({ length: count }, (_, index) => `${id}-puzzle-${index + 1}`);
  }

  function puzzlesForAssignment(assignment) {
    return assignment.seeds.map((seed) => MagicGenerator.makePuzzle(assignment.size, assignment.difficulty, seed));
  }

  function createAssignmentFromForm() {
    const title = document.getElementById("assignmentTitle").value.trim() || "Academy Rune Practice";
    const size = Number(document.getElementById("assignmentSize").value);
    const difficulty = document.getElementById("assignmentDifficulty").value;
    const count = Number(document.getElementById("assignmentCount").value);
    const id = `MSA-${Date.now().toString(36).toUpperCase()}`;
    const assignment = {
      v: 1,
      id,
      title,
      size,
      difficulty,
      count,
      hintsAllowed: document.getElementById("assignmentHints").checked,
      timed: document.getElementById("assignmentTimed").checked,
      seeds: assignmentSeeds(id, count),
      createdAt: new Date().toISOString()
    };
    assignment.code = encodeChallenge(assignment);
    currentAssignment = assignment;
    MagicStorage.saveAssignment(progress, assignment);
    renderTeacherTools();
    MagicUI.toast("Assignment generated.");
  }

  function renderTeacherTools() {
    const assignment = currentAssignment || progress.teacher?.currentAssignment;
    const results = progress.teacher?.results || [];
    if (assignment) {
      document.getElementById("assignmentPreviewTitle").textContent = assignment.title;
      document.getElementById("challengeCodeOutput").value = assignment.code || encodeChallenge(assignment);
      document.getElementById("assignmentSummary").innerHTML = `
        <b>${assignment.count} puzzle${assignment.count === 1 ? "" : "s"}</b> · ${assignment.size}x${assignment.size} · ${assignment.difficulty}<br>
        Hints ${assignment.hintsAllowed ? "allowed" : "disabled"} · ${assignment.timed ? "Time challenge" : "Untimed"}<br>
        Code: ${assignment.id}
      `;
      document.getElementById("worksheetPreview").innerHTML = worksheetHtml(assignment, false, true);
    }
    const completed = results.filter((item) => item.completed).length;
    const totalTime = results.reduce((sum, item) => sum + (item.time || 0), 0);
    const avgTime = results.length ? Math.round(totalTime / results.length) : null;
    const hints = results.reduce((sum, item) => sum + (item.hintsUsed || 0), 0);
    document.getElementById("progressReport").innerHTML = `
      <div><span>Puzzles completed</span><b>${progress.puzzlesSolved}</b></div>
      <div><span>Assignments completed</span><b>${completed}</b></div>
      <div><span>Best time</span><b>${MagicUI.secondsToClock(progress.bestTime)}</b></div>
      <div><span>Average assignment time</span><b>${MagicUI.secondsToClock(avgTime)}</b></div>
      <div><span>Hints used</span><b>${hints}</b></div>
      <div><span>Stars earned</span><b>${progress.stars}</b></div>
      <div><span>Daily streak</span><b>${progress.daily?.streak || 0}</b></div>
    `;
  }

  function worksheetHtml(assignment, answerKey = false, compact = false) {
    const puzzles = puzzlesForAssignment(assignment);
    return `
      <article class="${compact ? "worksheet compact" : "worksheet"}">
        <header>
          <h1>${answerKey ? "Answer Key: " : ""}${escapeHtml(assignment.title)}</h1>
          <p>${assignment.size}x${assignment.size} · ${assignment.difficulty} · Magic sum ${puzzles[0].magicSum}</p>
          ${answerKey ? "" : "<div class='student-lines'><span>Name: ____________________</span><span>Date: ____________________</span></div>"}
        </header>
        <p class="worksheet-instructions">${answerKey ? "Full solved grids for teacher use." : `Complete each magic square. Every row, column, and diagonal must equal ${puzzles[0].magicSum}. ${assignment.hintsAllowed ? "Hints may be used in game mode." : "Hints are not allowed for this assignment."}`}</p>
        <div class="worksheet-grid-list">
          ${puzzles.map((puzzle, index) => printablePuzzle(puzzle, index + 1, answerKey)).join("")}
        </div>
      </article>
    `;
  }

  function printablePuzzle(puzzle, number, answerKey) {
    const grid = answerKey ? puzzle.solution : puzzle.givens;
    return `
      <section class="print-puzzle">
        <h2>Puzzle ${number} · Magic Sum ${puzzle.magicSum}</h2>
        <div class="print-grid" style="--size:${puzzle.size}">
          ${grid.flat().map((value) => `<span>${value || ""}</span>`).join("")}
        </div>
      </section>
    `;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }

  function printAssignment(answerKey = false) {
    const assignment = currentAssignment || progress.teacher?.currentAssignment;
    if (!assignment) {
      MagicUI.toast("Generate an assignment first.");
      return;
    }
    const area = document.getElementById("printArea");
    area.innerHTML = worksheetHtml(assignment, answerKey);
    document.body.classList.add("printing-assignment");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-assignment"), 300);
  }

  function copyChallengeCode() {
    const output = document.getElementById("challengeCodeOutput");
    if (!output.value) {
      MagicUI.toast("Generate an assignment first.");
      return;
    }
    output.select();
    navigator.clipboard?.writeText(output.value);
    MagicUI.toast("Challenge code copied.");
  }

  function importChallenge() {
    const input = document.getElementById("challengeCodeInput");
    try {
      const assignment = decodeChallenge(input.value);
      if (!assignment || assignment.v !== 1 || !assignment.seeds?.length) throw new Error("Invalid assignment");
      currentAssignment = assignment;
      MagicStorage.setCurrentAssignment(progress, assignment);
      startAssignmentPuzzle(assignment, 0);
      MagicUI.toast(`Loaded ${assignment.title}.`);
    } catch (error) {
      MagicUI.toast("That challenge code could not be read.");
    }
  }

  function startAssignmentPuzzle(assignment, index) {
    const puzzle = MagicGenerator.makePuzzle(assignment.size, assignment.difficulty, assignment.seeds[index]);
    startRealm({
      name: assignment.title,
      size: assignment.size,
      difficulty: assignment.difficulty,
      icon: "✎",
      tone: "gold",
      lore: `Assignment puzzle ${index + 1} of ${assignment.count}.`
    }, { puzzle, assignment, assignmentIndex: index, skipStory: true });
    document.getElementById("realmSubtitle").textContent = `${assignment.title} · Puzzle ${index + 1}/${assignment.count}`;
  }

  function nextAssignmentPuzzle() {
    const nextIndex = state.assignmentIndex + 1;
    if (nextIndex >= state.assignment.count) {
      document.getElementById("winDialog").close();
      MagicUI.showView("world");
      MagicUI.toast("Assignment complete. Result saved locally.");
      return;
    }
    document.getElementById("winDialog").close();
    startAssignmentPuzzle(state.assignment, nextIndex);
  }

  function downloadFile(filename, mime, text) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function reportRows() {
    return (progress.teacher?.results || []).map((item) => ({
      student: item.student || "Local Student",
      assignment: item.assignmentTitle,
      size: item.size,
      difficulty: item.difficulty,
      completed: item.completed ? "yes" : "no",
      time: item.time,
      moves: item.moves,
      hints: item.hintsUsed,
      score: item.score,
      date: item.date
    }));
  }

  function exportTextReport() {
    const rows = reportRows();
    const text = [
      "Magic Square Academy Local Progress Report",
      `Generated: ${new Date().toLocaleString()}`,
      `Puzzles completed: ${progress.puzzlesSolved}`,
      `Best time: ${MagicUI.secondsToClock(progress.bestTime)}`,
      `Stars earned: ${progress.stars}`,
      "",
      ...rows.map((row) => `${row.date} | ${row.student} | ${row.assignment} | ${row.size}x${row.size} ${row.difficulty} | completed ${row.completed} | ${row.time}s | moves ${row.moves} | hints ${row.hints} | score ${row.score}`)
    ].join("\n");
    downloadFile("magic-square-progress-report.txt", "text/plain", text);
  }

  function exportCsvReport() {
    const header = ["student name", "assignment title", "puzzle size", "difficulty", "completed", "time", "moves", "hints used", "score", "date"];
    const rows = reportRows().map((row) => [row.student, row.assignment, row.size, row.difficulty, row.completed, row.time, row.moves, row.hints, row.score, row.date]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(",")).join("\n");
    downloadFile("magic-square-progress.csv", "text/csv", csv);
  }

  function maybeResumeSavedPuzzle() {
    const saved = progress.savedPuzzle;
    if (!saved || !saved.puzzle || !saved.entries) return false;
    document.getElementById("resumeDialog").showModal();
    return true;
  }

  function bindEvents() {
    MagicUI.renderRealms(startRealm, progress);
    renderBossRoster();
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        if (tab.dataset.tab === "teacher") renderTeacherTools();
        MagicUI.showView(tab.dataset.tab);
      });
    });
    document.getElementById("quickTrial").addEventListener("click", () => startRealm(MagicUI.realms[0]));
    document.getElementById("academyStart").addEventListener("click", () => startRealm(MagicUI.realms[0]));
    document.getElementById("dailyChallengeButton").addEventListener("click", startDailyChallenge);
    document.getElementById("dailyEliteButton").addEventListener("click", startDailyElite);
    document.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => startMode(button.dataset.mode));
    });
    document.getElementById("importChallengeButton").addEventListener("click", importChallenge);
    document.getElementById("challengeCodeInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") importChallenge();
    });
    document.getElementById("assignmentForm").addEventListener("submit", (event) => {
      event.preventDefault();
      createAssignmentFromForm();
    });
    document.getElementById("copyChallengeCode").addEventListener("click", copyChallengeCode);
    document.getElementById("printWorksheetButton").addEventListener("click", () => printAssignment(false));
    document.getElementById("printAnswerKeyButton").addEventListener("click", () => printAssignment(true));
    document.getElementById("exportTextReport").addEventListener("click", exportTextReport);
    document.getElementById("exportCsvReport").addEventListener("click", exportCsvReport);
    document.getElementById("storyButton").addEventListener("click", () => showStory("Academy Chronicle", "The Towers Have Fallen", "The ancient rune towers have fallen into chaos. Solve magic squares across the realms to restore their balance."));
    document.getElementById("startBossButton").addEventListener("click", () => startBossBattle());
    document.getElementById("skipBossButton").addEventListener("click", () => startBossBattle());
    document.getElementById("retryBossButton").addEventListener("click", () => {
      document.getElementById("defeatDialog").close();
      startBossBattle(pendingBoss || bosses.find((boss) => boss.key === state.boss.key));
    });
    document.getElementById("retreatButton").addEventListener("click", () => {
      document.getElementById("defeatDialog").close();
      document.body.classList.remove("boss-arena", "boss-rage");
      MagicUI.showView("world");
    });
    document.getElementById("closeStoryButton").addEventListener("click", () => {
      progress.storySeen = true;
      MagicStorage.save(progress);
      document.getElementById("storyDialog").close();
      if (!progress.tutorialComplete) document.getElementById("tutorialDialog").showModal();
    });
    document.getElementById("backToWorld").addEventListener("click", () => MagicUI.showView("world"));
    document.getElementById("sizeSelect").addEventListener("change", (event) => startRealm(state.realm, { size: event.target.value }));
    document.getElementById("difficultySelect").addEventListener("change", (event) => startRealm(state.realm, { difficulty: event.target.value }));
    document.getElementById("checkAnswer").addEventListener("click", checkAnswer);
    document.getElementById("hintButton").addEventListener("click", giveHint);
    document.getElementById("resetButton").addEventListener("click", resetPuzzle);
    document.getElementById("newPuzzleButton").addEventListener("click", newPuzzle);
    document.getElementById("undoButton").addEventListener("click", undoMove);
    document.getElementById("clearBoardButton").addEventListener("click", clearBoard);
    document.getElementById("tutorialButton").addEventListener("click", () => document.getElementById("tutorialDialog").showModal());
    document.getElementById("closeTutorialButton").addEventListener("click", () => {
      progress.tutorialComplete = true;
      MagicStorage.save(progress);
      document.getElementById("tutorialDialog").close();
    });
    document.getElementById("playAgainButton").addEventListener("click", playAgain);
    document.getElementById("nextRealmButton").addEventListener("click", nextRealm);
    document.getElementById("resumePuzzleButton").addEventListener("click", () => {
      const saved = progress.savedPuzzle;
      document.getElementById("resumeDialog").close();
      if (saved) startRealm(saved.realm, {
        puzzle: saved.puzzle,
        resume: saved,
        daily: saved.daily,
        boss: saved.boss,
        assignment: saved.assignment,
        assignmentIndex: saved.assignmentIndex,
        battleCarry: saved.boss ? {
          playerHp: saved.playerHp || 100,
          mana: saved.mana || 100,
          combo: saved.combo || 0,
          bestCombo: saved.bestCombo || 0,
          damageDealt: saved.damageDealt || 0,
          spellsCast: saved.spellsCast || 0
        } : null
      });
    });
    document.getElementById("discardPuzzleButton").addEventListener("click", () => {
      progress.savedPuzzle = null;
      MagicStorage.save(progress);
      document.getElementById("resumeDialog").close();
      startRealm(MagicUI.realms[0], { skipStory: true });
      MagicUI.showView("world");
    });
    document.getElementById("continueButton").addEventListener("click", () => {
      document.getElementById("winDialog").close();
      document.body.classList.remove("boss-arena", "boss-rage");
      MagicUI.showView("world");
    });
    document.getElementById("muteToggle").addEventListener("change", (event) => {
      progress.muted = event.target.checked;
      MagicStorage.save(progress);
      MagicEffects.configure(progress.settings, progress.muted);
    });
    document.getElementById("contrastToggle").addEventListener("change", (event) => {
      progress.settings.highContrast = event.target.checked;
      MagicStorage.save(progress);
      MagicUI.renderProgress(progress);
    });
    document.getElementById("motionToggle").addEventListener("change", (event) => {
      progress.settings.reducedMotion = event.target.checked;
      MagicStorage.save(progress);
      MagicUI.renderProgress(progress);
    });
    document.getElementById("animationIntensity").addEventListener("input", (event) => {
      progress.settings.animationIntensity = Number(event.target.value);
      progress.settings.animation = progress.settings.animationIntensity < 20 ? "low" : progress.settings.animationIntensity < 65 ? "calm" : "full";
      MagicStorage.save(progress);
      MagicUI.renderProgress(progress);
    });
    document.getElementById("particleIntensity").addEventListener("input", (event) => {
      progress.settings.particleIntensity = Number(event.target.value);
      MagicStorage.save(progress);
      MagicUI.renderProgress(progress);
    });
    document.getElementById("fontScale").addEventListener("input", (event) => {
      progress.settings.fontScale = Number(event.target.value);
      MagicStorage.save(progress);
      MagicUI.renderProgress(progress);
    });
    document.getElementById("colorblindToggle").addEventListener("change", (event) => {
      progress.settings.colorblind = event.target.checked;
      MagicStorage.save(progress);
      MagicUI.renderProgress(progress);
    });
    document.getElementById("musicVolume").addEventListener("input", (event) => {
      progress.settings.musicVolume = Number(event.target.value);
      MagicStorage.save(progress);
      MagicEffects.configure(progress.settings, progress.muted);
    });
    document.getElementById("soundVolume").addEventListener("input", (event) => {
      progress.settings.soundVolume = Number(event.target.value);
      MagicStorage.save(progress);
      MagicEffects.configure(progress.settings, progress.muted);
    });
    document.getElementById("resetProgress").addEventListener("click", () => {
      progress = JSON.parse(JSON.stringify(MagicStorage.defaults));
      MagicStorage.save(progress);
      MagicUI.renderProgress(progress);
      MagicUI.renderRealms(startRealm, progress);
      MagicUI.toast("Local progress reset.");
    });
    document.getElementById("companionPanel").addEventListener("click", (event) => {
      const button = event.target.closest("[data-companion]");
      if (!button || button.disabled) return;
      progress.companions.active = button.dataset.companion;
      MagicStorage.save(progress);
      MagicUI.renderProgress(progress);
      MagicUI.toast(`${MagicUI.companions[button.dataset.companion].name} is traveling with you.`);
    });
    document.getElementById("titleSelect").addEventListener("change", (event) => {
      progress.selectedTitle = event.target.value;
      MagicStorage.save(progress);
      MagicUI.renderProgress(progress);
      MagicUI.toast(`${event.target.value} title equipped.`);
    });
    document.getElementById("runTests").addEventListener("click", () => {
      clearSelection();
      const result = MagicGenerator.runGeneratorTests();
      document.getElementById("testOutput").textContent = JSON.stringify(result, null, 2);
      MagicUI.toast(result.passed ? "Generator tests passed." : "Generator tests found issues.");
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        clearSelection();
        renderTrial();
      }
    });
    document.addEventListener("click", (event) => {
      if (!selectedNumber && !selectedCell) return;
      if (event.target.closest(".magic-board, .number-bank, .trial-controls, button, select, dialog")) return;
      clearSelection();
      renderTrial();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    MagicUI.renderProgress(progress);
    currentAssignment = progress.teacher?.currentAssignment || null;
    renderTeacherTools();
    MagicEffects.initParticles();
    unlockRealms();
    const resumed = maybeResumeSavedPuzzle();
    if (!resumed) startRealm(MagicUI.realms[0], { skipStory: true });
    if (!resumed && !progress.storySeen) showStory("Academy Chronicle", "The Towers Have Fallen", "The ancient rune towers have fallen into chaos. Each balanced square restores a little order to the academy map.");
    if (!resumed && progress.storySeen && !progress.tutorialComplete) document.getElementById("tutorialDialog").showModal();
    if (!resumed) MagicUI.showView("world");
    MagicEffects.completeLoading();
  });
})();
