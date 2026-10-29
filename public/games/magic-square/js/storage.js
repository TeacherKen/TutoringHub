(function () {
  const KEY = "magic-square-academy-phase1";
  const defaults = {
    xp: 0,
    level: 1,
    stars: 0,
    puzzlesSolved: 0,
    bestTime: null,
    muted: false,
    tutorialComplete: false,
    storySeen: false,
    daily: { streak: 0, completedDate: null, lastPlayedDate: null },
    companions: {
      active: "owl",
      xp: 0,
      levels: { owl: 1 },
      unlocked: ["owl"]
    },
    spells: {
      mana: 100,
      levels: { fireball: 1, blast: 1, shield: 1, purify: 1, reveal: 1, freeze: 1, surge: 1, double: 1 },
      unlocked: ["fireball", "blast", "shield", "purify", "reveal", "freeze", "surge"]
    },
    settings: {
      animation: "full",
      animationIntensity: 100,
      particleIntensity: 75,
      fontScale: 100,
      colorblind: false,
      highContrast: false,
      reducedMotion: false,
      musicVolume: 45,
      soundVolume: 70
    },
    unlockedRealms: ["Apprentice Hall"],
    unlockedBosses: ["frost"],
    bossVictories: {},
    battleStats: {
      encounters: 0,
      wins: 0,
      failures: 0,
      totalDamage: 0,
      bestCombo: 0,
      spellsCast: 0,
      history: []
    },
    title: "Apprentice",
    selectedTitle: "Apprentice",
    unlockedTitles: ["Apprentice", "Apprentice Solver"],
    badges: [],
    modes: {
      endlessBest: 0,
      gauntletBest: 0,
      dailyEliteDate: null
    },
    achievements: {},
    teacher: {
      assignments: [],
      currentAssignment: null,
      results: []
    },
    savedPuzzle: null
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY)) || {};
      return {
        ...defaults,
        ...saved,
        daily: { ...defaults.daily, ...(saved.daily || {}) },
        companions: {
          ...defaults.companions,
          ...(saved.companions || {}),
          levels: { ...defaults.companions.levels, ...(saved.companions?.levels || {}) },
          unlocked: saved.companions?.unlocked || defaults.companions.unlocked
        },
        spells: {
          ...defaults.spells,
          ...(saved.spells || {}),
          levels: { ...defaults.spells.levels, ...(saved.spells?.levels || {}) },
          unlocked: saved.spells?.unlocked || defaults.spells.unlocked
        },
        settings: { ...defaults.settings, ...(saved.settings || {}) },
        unlockedRealms: saved.unlockedRealms || defaults.unlockedRealms,
        unlockedBosses: saved.unlockedBosses || defaults.unlockedBosses,
        unlockedTitles: saved.unlockedTitles || defaults.unlockedTitles,
        badges: saved.badges || defaults.badges,
        modes: { ...defaults.modes, ...(saved.modes || {}) },
        bossVictories: { ...defaults.bossVictories, ...(saved.bossVictories || {}) },
        battleStats: {
          ...defaults.battleStats,
          ...(saved.battleStats || {}),
          history: saved.battleStats?.history || []
        },
        teacher: {
          ...defaults.teacher,
          ...(saved.teacher || {}),
          assignments: saved.teacher?.assignments || [],
          results: saved.teacher?.results || []
        },
        achievements: { ...defaults.achievements, ...(saved.achievements || {}) }
      };
    } catch (error) {
      return { ...defaults };
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function todayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
  }

  function rankFor(level) {
    if (level >= 14) return "Arcane Master";
    if (level >= 12) return "Grand Arcanist";
    if (level >= 8) return "Rune Adept";
    if (level >= 5) return "Crystal Sage";
    if (level >= 4) return "Junior Arcanist";
    return "Novice";
  }

  function titleFor(level) {
    if (level >= 10) return "Arcane Master";
    if (level >= 7) return "Crystal Sage";
    if (level >= 4) return "Rune Adept";
    return "Apprentice";
  }

  function starsForHints(hintsUsed) {
    if (hintsUsed === 0) return 3;
    if (hintsUsed === 1) return 2;
    return 1;
  }

  function addWin(progress, payload) {
    let earnedXp = payload.size * 35 + (payload.hintsUsed === 0 ? 30 : 0);
    let earnedStars = starsForHints(payload.hintsUsed);
    if (payload.doubleXp) earnedXp *= 2;
    const activeCompanion = progress.companions?.active || "owl";
    const companionLevel = progress.companions?.levels?.[activeCompanion] || 1;
    if (activeCompanion === "owl" || activeCompanion === "moonOwl") earnedXp = Math.ceil(earnedXp * (1.04 + companionLevel * 0.01));
    if (activeCompanion === "phoenix" && payload.mode === "speed") earnedXp += 35;
    if (activeCompanion === "golem" && payload.hintsUsed === 0) earnedStars += 1;
    if (progress.companions?.active === "dragonling" && payload.boss) earnedXp += 50;
    if (payload.daily) {
      earnedXp += 80;
      earnedStars += 2;
      const today = todayKey();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      progress.daily.streak = progress.daily.completedDate === todayKey(yesterday) ? progress.daily.streak + 1 : Math.max(1, progress.daily.streak || 1);
      progress.daily.completedDate = today;
      progress.daily.lastPlayedDate = today;
    }
    if (payload.mode === "gauntlet") earnedXp += 45 * (payload.combo || 1);
    if (payload.mode === "speed") earnedXp += payload.seconds < 90 ? 120 : 55;
    if (payload.mode === "noHints") earnedXp += 100;
    if (payload.mode === "endless") earnedXp += 30 * (payload.combo || 1);
    if (payload.mode === "dailyElite") {
      earnedXp += 180;
      earnedStars += 3;
      progress.modes.dailyEliteDate = todayKey();
    }
    progress.xp += earnedXp;
    progress.stars += earnedStars;
    progress.puzzlesSolved += 1;
    while (progress.xp >= progress.level * 100) progress.level += 1;
    progress.title = titleFor(progress.level);
    unlockTitle(progress, progress.title);
    progress.companions.xp += Math.max(20, Math.round(earnedXp * 0.35));
    const active = progress.companions.active || "owl";
    progress.companions.levels[active] = Math.min(10, (progress.companions.levels[active] || 1) + (earnedXp >= 150 ? 1 : 0));
    if (progress.xp >= 300 && !progress.companions.unlocked.includes("fox")) progress.companions.unlocked.push("fox");
    if (progress.xp >= 650 && !progress.companions.unlocked.includes("spirit")) progress.companions.unlocked.push("spirit");
    if (progress.xp >= 1000 && !progress.companions.unlocked.includes("dragonling")) progress.companions.unlocked.push("dragonling");
    if (progress.xp >= 150 && !progress.companions.unlocked.includes("moonOwl")) progress.companions.unlocked.push("moonOwl");
    if (progress.xp >= 450 && !progress.companions.unlocked.includes("cat")) progress.companions.unlocked.push("cat");
    if (progress.xp >= 800 && !progress.companions.unlocked.includes("phoenix")) progress.companions.unlocked.push("phoenix");
    if (progress.xp >= 1200 && !progress.companions.unlocked.includes("golem")) progress.companions.unlocked.push("golem");
    if (progress.xp >= 1600 && !progress.companions.unlocked.includes("tinyDragon")) progress.companions.unlocked.push("tinyDragon");
    if (progress.xp >= 250 && !progress.spells.unlocked.includes("double")) progress.spells.unlocked.push("double");
    Object.keys(progress.spells.levels).forEach((key) => {
      if (progress.xp >= 900 && progress.spells.unlocked.includes(key)) progress.spells.levels[key] = Math.max(progress.spells.levels[key] || 1, 2);
      if (progress.xp >= 1800 && progress.spells.unlocked.includes(key)) progress.spells.levels[key] = Math.max(progress.spells.levels[key] || 1, 3);
    });
    if (!progress.bestTime || payload.seconds < progress.bestTime) progress.bestTime = payload.seconds;
    progress.achievements.firstWin = true;
    progress.achievements.firstVictory = true;
    if (payload.hintsUsed === 0) progress.achievements.noHints = true;
    if (payload.hintsUsed > 0) progress.achievements.hintMaster = true;
    if (payload.seconds < 120) progress.achievements.fastSolver = true;
    if (payload.mistakes === 0) progress.achievements.noMistakes = true;
    if (payload.daily) progress.achievements.dailyChallenger = true;
    if (payload.size === 5) {
      progress.achievements.master5 = true;
      progress.achievements.champion5 = true;
    }
    if (payload.boss) {
      progress.bossVictories[payload.boss] = true;
      progress.achievements.bossBreaker = true;
      unlockTitle(progress, "Chaos Conqueror");
      addBadge(progress, "Boss Victor");
      progress.battleStats.wins += 1;
      progress.battleStats.totalDamage += payload.damageDealt || 0;
      progress.battleStats.bestCombo = Math.max(progress.battleStats.bestCombo, payload.battleCombo || 0);
      progress.battleStats.spellsCast += payload.spellsCast || 0;
      progress.battleStats.history.unshift({
        boss: payload.bossName || payload.boss,
        outcome: "Victory",
        seconds: payload.seconds,
        damage: payload.damageDealt || 0,
        date: new Date().toISOString()
      });
      progress.battleStats.history = progress.battleStats.history.slice(0, 8);
    }
    if ((progress.daily.streak || 0) >= 7) progress.achievements.perfectWeek = true;
    if ((progress.daily.streak || 0) >= 10) progress.achievements.tenDayStreak = true;
    if (progress.puzzlesSolved >= 100) progress.achievements.hundredSolved = true;
    if (payload.size === 5 && payload.seconds < 180) progress.achievements.speed5 = true;
    if (payload.mode === "endless") {
      progress.modes.endlessBest = Math.max(progress.modes.endlessBest || 0, payload.combo || 1);
      if ((payload.combo || 1) >= 5) progress.achievements.endlessMilestone = true;
    }
    if (payload.mode === "gauntlet") {
      progress.modes.gauntletBest = Math.max(progress.modes.gauntletBest || 0, payload.combo || 1);
      addBadge(progress, "Gauntlet Runner");
    }
    if (payload.mode === "dailyElite") {
      progress.achievements.dailyElite = true;
      addBadge(progress, "Daily Elite");
    }
    if (payload.hintsUsed === 0) unlockTitle(progress, "Puzzle Sage");
    if (payload.size === 5) unlockTitle(progress, "Frostbreaker");
    if (progress.level >= 14) unlockTitle(progress, "Arcane Grandmaster");
    progress.savedPuzzle = null;
    save(progress);
    return { earnedXp, earnedStars };
  }

  function saveAssignment(progress, assignment) {
    progress.teacher = progress.teacher || { assignments: [], currentAssignment: null, results: [] };
    progress.teacher.assignments = [assignment, ...(progress.teacher.assignments || []).filter((item) => item.id !== assignment.id)].slice(0, 20);
    progress.teacher.currentAssignment = assignment;
    save(progress);
  }

  function setCurrentAssignment(progress, assignment) {
    progress.teacher = progress.teacher || { assignments: [], currentAssignment: null, results: [] };
    progress.teacher.currentAssignment = assignment;
    save(progress);
  }

  function recordAssignmentResult(progress, result) {
    progress.teacher = progress.teacher || { assignments: [], currentAssignment: null, results: [] };
    progress.teacher.results = [result, ...(progress.teacher.results || [])].slice(0, 200);
    save(progress);
  }

  function saveCurrentPuzzle(progress, snapshot) {
    progress.savedPuzzle = snapshot;
    save(progress);
  }

  function startBossEncounter(progress) {
    progress.battleStats.encounters += 1;
    save(progress);
  }

  function recordBossFailure(progress, payload) {
    progress.battleStats.failures += 1;
    progress.battleStats.totalDamage += payload.damageDealt || 0;
    progress.battleStats.bestCombo = Math.max(progress.battleStats.bestCombo, payload.bestCombo || 0);
    progress.battleStats.spellsCast += payload.spellsCast || 0;
    progress.xp += payload.partialXp || 0;
    progress.battleStats.history.unshift({
      boss: payload.bossName,
      outcome: "Defeat",
      seconds: payload.seconds,
      damage: payload.damageDealt || 0,
      date: new Date().toISOString()
    });
    progress.battleStats.history = progress.battleStats.history.slice(0, 8);
    progress.savedPuzzle = null;
    while (progress.xp >= progress.level * 100) progress.level += 1;
    save(progress);
  }

  function unlockTitle(progress, title) {
    progress.unlockedTitles = progress.unlockedTitles || [];
    if (!progress.unlockedTitles.includes(title)) progress.unlockedTitles.push(title);
  }

  function addBadge(progress, badge) {
    progress.badges = progress.badges || [];
    if (!progress.badges.includes(badge)) progress.badges.push(badge);
  }

  window.MagicStorage = { load, save, addWin, rankFor, titleFor, defaults, starsForHints, todayKey, saveCurrentPuzzle, saveAssignment, setCurrentAssignment, recordAssignmentResult, startBossEncounter, recordBossFailure };
})();
