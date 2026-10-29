(function () {
  const realms = [
    { name: "Apprentice Hall", size: 3, difficulty: "easy", icon: "🏰", tone: "emerald", xp: 0, lore: "The first tower teaches balance: every row, column, and diagonal must sing the same sum." },
    { name: "Crystal Sanctum", size: 3, difficulty: "medium", icon: "💎", tone: "cyan", xp: 120, lore: "Crystal mirrors split the square into sparkling patterns. Restore the sanctum by reading totals carefully." },
    { name: "Arcane Forest", size: 4, difficulty: "medium", icon: "🌲", tone: "green", xp: 300, lore: "Fireflies mark missing runes in the living woods. The forest rewards patient arithmetic." },
    { name: "Frostspire Peak", size: 5, difficulty: "hard", icon: "❄", tone: "blue", xp: 650, modifier: "frost", lore: "The Frost Queen froze the northern sanctums. Larger squares need calm focus and clever hints." },
    { name: "Inferno Citadel", size: 5, difficulty: "hard", icon: "🔥", tone: "orange", xp: 1000, modifier: "pressure", lore: "Lava-lit equations churn below the citadel. Only a true rune adept can quiet the heat." },
    { name: "Storm Temple", size: 4, difficulty: "hard", icon: "⚡", tone: "storm", xp: 1300, modifier: "storm", lore: "Lightning flashes across ancient columns, but the sums still reveal the path." },
    { name: "Shadow Archives", size: 5, difficulty: "hard", icon: "◐", tone: "shadow", xp: 1600, modifier: "shadow", lore: "Hidden totals sleep in the old shelves until enough runes are placed." },
    { name: "Celestial Observatory", size: 5, difficulty: "medium", icon: "☄", tone: "celestial", xp: 1900, modifier: "celestial", lore: "Star charts bend around each diagonal. This realm rewards diagonal thinking." },
    { name: "Emerald Wilds", size: 4, difficulty: "medium", icon: "❖", tone: "emerald", xp: 2200, modifier: "wilds", lore: "Living vines nudge attention toward nearly complete rows." },
    { name: "Void Citadel", size: 5, difficulty: "hard", icon: "✹", tone: "void", xp: 2600, modifier: "void", lore: "Dark fog and corrupted runes test focus, but no curse can break arithmetic." }
  ];

  const companions = {
    owl: { name: "Owl Familiar", icon: "🦉", bonus: "+5% XP from every solved trial" },
    fox: { name: "Crystal Fox", icon: "🦊", bonus: "Starts each puzzle with +1 mana pulse" },
    spirit: { name: "Rune Spirit", icon: "✦", bonus: "Hints glow longer and feel clearer" },
    dragonling: { name: "Dragonling", icon: "🐉", bonus: "+50 XP from boss victories" },
    phoenix: { name: "Phoenix Hatchling", icon: "🔥", bonus: "+35 XP during Speed Trials", rarity: "epic" },
    moonOwl: { name: "Moon Owl", icon: "☾", bonus: "Scaling XP bonus as it levels", rarity: "rare" },
    cat: { name: "Arcane Cat", icon: "✧", bonus: "Starts with calmer spell cooldowns", rarity: "rare" },
    golem: { name: "Rune Golem", icon: "▣", bonus: "+1 star on no-hint wins", rarity: "epic" },
    tinyDragon: { name: "Tiny Dragon", icon: "✹", bonus: "Boosts rare reward finds", rarity: "legendary" }
  };

  const spells = {
    fireball: { name: "Fireball", icon: "🔥", cost: 34, text: "Deal direct boss damage after a correct placement." },
    blast: { name: "Arcane Blast", icon: "✦", cost: 28, text: "Strike the boss and boost combo." },
    shield: { name: "Shield", icon: "🛡", cost: 25, text: "Block the next boss attack." },
    purify: { name: "Purify Curse", icon: "✨", cost: 32, text: "Clear curses and reveal trouble spots." },
    reveal: { name: "Reveal Rune", icon: "👁", cost: 30, text: "Reveal one correct editable cell." },
    freeze: { name: "Freeze Time", icon: "⏳", cost: 20, text: "Pause pressure briefly." },
    surge: { name: "Mana Surge", icon: "⚡", cost: 0, text: "Restore mana once its cooldown ends." },
    double: { name: "Double XP", icon: "◆", cost: 45, text: "Double XP on this puzzle if you win." }
  };

  const achievements = [
    { key: "firstVictory", title: "First Victory", text: "Win your first puzzle", reward: "50 XP", icon: "⭐", category: "Basics", rarity: "common", progress: (p) => Math.min(1, p.puzzlesSolved) },
    { key: "hintMaster", title: "Hint Master", text: "Use a smart hint and still complete training", reward: "75 XP", icon: "💡", category: "Learning", rarity: "common", progress: (p) => p.achievements.hintMaster ? 1 : 0 },
    { key: "noHints", title: "No Hints Used", text: "Win without using hints", reward: "75 XP", icon: "🛡", category: "Skill", rarity: "rare", progress: (p) => p.achievements.noHints ? 1 : 0 },
    { key: "fastSolver", title: "Fast Solver", text: "Complete a puzzle in under 2 minutes", reward: "100 XP", icon: "⏱", category: "Skill", rarity: "rare", progress: (p) => p.achievements.fastSolver ? 1 : 0 },
    { key: "dailyChallenger", title: "Daily Challenger", text: "Complete a daily challenge", reward: "120 XP", icon: "☀", category: "Daily", rarity: "epic", progress: (p) => p.achievements.dailyChallenger ? 1 : 0 },
    { key: "champion5", title: "5x5 Champion", text: "Win a 5x5 puzzle", reward: "150 XP", icon: "▦", category: "Mastery", rarity: "epic", progress: (p) => p.achievements.champion5 || p.achievements.master5 ? 1 : 0 },
    { key: "perfectWeek", title: "Perfect Week", text: "Build a 7-day daily streak", reward: "250 XP", icon: "✦", category: "Daily", rarity: "legendary", progress: (p) => Math.min(1, (p.daily?.streak || 0) / 7) },
    { key: "bossBreaker", title: "Boss Breaker", text: "Win a boss encounter", reward: "200 XP", icon: "☠", category: "Adventure", rarity: "legendary", progress: (p) => p.achievements.bossBreaker ? 1 : 0 },
    { key: "tenDayStreak", title: "10-Day Streak", text: "Build a 10-day daily streak", reward: "300 XP", icon: "☀", category: "Daily", rarity: "legendary", progress: (p) => Math.min(1, (p.daily?.streak || 0) / 10) },
    { key: "hundredSolved", title: "100 Puzzle Sage", text: "Solve 100 puzzles", reward: "500 XP", icon: "◆", category: "Mastery", rarity: "legendary", progress: (p) => Math.min(1, (p.puzzlesSolved || 0) / 100) },
    { key: "noMistakes", title: "Clean Casting", text: "Complete a puzzle with no mistakes", reward: "120 XP", icon: "✓", category: "Skill", rarity: "rare", progress: (p) => p.achievements.noMistakes ? 1 : 0 },
    { key: "speed5", title: "5x5 Speed Clear", text: "Solve a 5x5 in under 3 minutes", reward: "180 XP", icon: "⚡", category: "Speed", rarity: "epic", progress: (p) => p.achievements.speed5 ? 1 : 0 },
    { key: "endlessMilestone", title: "Endless Initiate", text: "Clear 5 endless puzzles in a chain", reward: "220 XP", icon: "∞", category: "Modes", rarity: "epic", progress: (p) => Math.min(1, (p.modes?.endlessBest || 0) / 5) },
    { key: "dailyElite", title: "Elite Challenger", text: "Complete a Daily Elite challenge", reward: "240 XP", icon: "✹", category: "Modes", rarity: "legendary", progress: (p) => p.achievements.dailyElite ? 1 : 0 }
  ];

  function secondsToClock(seconds) {
    if (seconds === null || seconds === undefined) return "--:--";
    const min = Math.floor(seconds / 60).toString().padStart(2, "0");
    const sec = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
  }

  function showView(name) {
    document.body.dataset.view = name;
    const active = document.querySelector(".view.active");
    const next = document.getElementById(`${name}View`);
    if (active !== next && window.MagicEffects) MagicEffects.transition(name === "trial" ? "realm" : "screen");
    document.querySelectorAll(".view").forEach((view) => {
      const selected = view === next;
      view.classList.toggle("active", selected);
      if (selected) {
        view.classList.remove("scene-arrive");
        requestAnimationFrame(() => view.classList.add("scene-arrive"));
      }
    });
    document.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
    if (name === "world" && window.MagicEffects) {
      document.body.classList.remove("boss-arena", "boss-rage", "low-hp");
      MagicEffects.setRealmAtmosphere("default", false);
    }
  }

  function isRealmUnlocked(progress, realm) {
    return progress.xp >= realm.xp || progress.unlockedRealms?.includes(realm.name);
  }

  function renderRealms(onEnter, progress = {}) {
    const grid = document.getElementById("realmGrid");
    grid.innerHTML = realms.map((realm, index) => `
      <article class="realm-card ${realm.tone} ${isRealmUnlocked(progress, realm) ? "unlocked" : "locked"}" style="--delay:${index * 90}ms">
        <div class="island ${realm.tone}"><span>${realm.icon}</span></div>
        <h3>${realm.name}</h3>
        <p>${realm.size}x${realm.size} · ${realm.difficulty}</p>
        <small>${isRealmUnlocked(progress, realm) ? realm.lore : `Unlocks at ${realm.xp} XP`}</small>
        <button type="button" data-realm="${index}" ${isRealmUnlocked(progress, realm) ? "" : "disabled"}>${isRealmUnlocked(progress, realm) ? "Enter" : "Locked"}</button>
      </article>
    `).join("");
    grid.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => onEnter(realms[Number(button.dataset.realm)]));
    });
  }

  function renderProgress(progress) {
    const next = progress.level * 100;
    document.getElementById("playerLevel").textContent = `Level ${progress.level}`;
    document.getElementById("xpFill").style.width = `${Math.min(100, progress.xp / next * 100)}%`;
    document.getElementById("xpText").textContent = `${progress.xp} / ${next} XP`;
    document.getElementById("playerStars").textContent = progress.stars;
    document.getElementById("puzzlesSolved").textContent = progress.puzzlesSolved;
    document.getElementById("bestTime").textContent = secondsToClock(progress.bestTime);
    document.getElementById("playerRank").textContent = MagicStorage.rankFor(progress.level);
    document.getElementById("profileTitle").textContent = progress.selectedTitle || progress.title || MagicStorage.titleFor(progress.level);
    document.getElementById("profileRank").textContent = MagicStorage.rankFor(progress.level);
    document.getElementById("profileXpFill").style.width = `${Math.min(100, progress.xp / next * 100)}%`;
    document.getElementById("profileXpText").textContent = `${progress.xp} / ${next} XP`;
    document.getElementById("trialStars").textContent = progress.stars;
    document.getElementById("trialXp").textContent = progress.xp;
    document.getElementById("muteToggle").checked = progress.muted;
    document.getElementById("contrastToggle").checked = !!progress.settings?.highContrast;
    document.getElementById("motionToggle").checked = !!progress.settings?.reducedMotion;
    const animationIntensity = progress.settings?.animationIntensity ?? (progress.settings?.animation === "low" ? 0 : progress.settings?.animation === "calm" ? 50 : 100);
    const particleIntensity = progress.settings?.particleIntensity ?? 75;
    const fontScale = progress.settings?.fontScale ?? 100;
    document.getElementById("animationIntensity").value = animationIntensity;
    document.getElementById("particleIntensity").value = particleIntensity;
    document.getElementById("fontScale").value = fontScale;
    document.getElementById("colorblindToggle").checked = !!progress.settings?.colorblind;
    document.getElementById("animationValue").textContent = animationIntensity < 20 ? "Off" : animationIntensity < 65 ? "Calm" : "Full";
    document.getElementById("particleValue").textContent = particleIntensity < 15 ? "Off" : particleIntensity < 60 ? "Calm" : "Full";
    document.getElementById("fontScaleValue").textContent = `${fontScale}%`;
    document.getElementById("musicVolume").value = progress.settings?.musicVolume ?? 45;
    document.getElementById("soundVolume").value = progress.settings?.soundVolume ?? 70;
    document.body.classList.toggle("high-contrast", !!progress.settings?.highContrast);
    document.body.classList.toggle("reduced-motion", !!progress.settings?.reducedMotion);
    document.body.classList.toggle("colorblind-friendly", !!progress.settings?.colorblind);
    document.documentElement.style.setProperty("--font-scale", String(fontScale / 100));
    document.body.dataset.animation = animationIntensity < 20 ? "low" : animationIntensity < 65 ? "calm" : "full";
    if (window.MagicEffects) MagicEffects.configure(progress.settings, progress.muted);
    renderCompanion(progress);
    renderSpellInventory(progress);
    renderRealmUnlocks(progress);
    renderTitles(progress);
    renderBattleStats(progress);
    renderAchievements(progress);
    renderDaily(progress);
  }

  function renderCompanion(progress) {
    const companion = companions[progress.companions?.active || "owl"] || companions.owl;
    document.getElementById("companionAvatar").textContent = companion.icon;
    document.getElementById("companionName").textContent = companion.name;
    document.getElementById("companionBonus").textContent = companion.bonus;
    document.getElementById("companionPanel").innerHTML = Object.entries(companions).map(([key, item]) => {
      const unlocked = progress.companions?.unlocked?.includes(key);
      const active = (progress.companions?.active || "owl") === key;
      return `<button class="companion-choice ${active ? "active" : ""}" data-companion="${key}" ${unlocked ? "" : "disabled"}>
        <span>${item.icon}</span><b>${item.name}</b><small>${unlocked ? `Lv ${progress.companions?.levels?.[key] || 1} · ${item.rarity || "common"} · ${item.bonus}` : "Locked"}</small>
      </button>`;
    }).join("");
  }

  function renderSpellInventory(progress) {
    document.getElementById("spellInventory").innerHTML = Object.entries(spells).map(([key, spell]) => {
      const unlocked = progress.spells?.unlocked?.includes(key);
      const level = progress.spells?.levels?.[key] || 1;
      return `<article class="spell-item ${unlocked ? "" : "locked"}"><span>${spell.icon}</span><b>${spell.name}</b><small>${unlocked ? `Level ${level} · ${Math.max(8, spell.cost - level * 2)} mana · ${spell.text}` : "Locked by XP"}</small></article>`;
    }).join("");
  }

  function renderTitles(progress) {
    const titles = progress.unlockedTitles || ["Apprentice"];
    document.getElementById("titleSelect").innerHTML = titles.map((title) =>
      `<option value="${title}" ${title === (progress.selectedTitle || progress.title) ? "selected" : ""}>${title}</option>`
    ).join("");
    document.getElementById("badgeList").innerHTML = (progress.badges || []).map((badge) =>
      `<span class="badge">${badge}</span>`
    ).join("") || "<span class='badge dim'>No badges yet</span>";
  }

  function renderBattleStats(progress) {
    const stats = progress.battleStats || {};
    document.getElementById("battleStats").innerHTML = `
      <div><span>Bosses Defeated</span><b>${stats.wins || 0}</b></div>
      <div><span>Encounters</span><b>${stats.encounters || 0}</b></div>
      <div><span>Total Damage</span><b>${stats.totalDamage || 0}</b></div>
      <div><span>Best Combo</span><b>x${stats.bestCombo || 0}</b></div>
    `;
    document.getElementById("battleHistory").innerHTML = (stats.history || []).map((entry) => `
      <div class="history-row ${entry.outcome.toLowerCase()}">
        <span>${entry.boss}</span>
        <b>${entry.outcome}</b>
        <small>${secondsToClock(entry.seconds)} · ${entry.damage} dmg</small>
      </div>
    `).join("") || "<p>No encounters recorded yet.</p>";
  }

  function renderRealmUnlocks(progress) {
    document.getElementById("realmUnlockList").innerHTML = realms.map((realm) => {
      const unlocked = isRealmUnlocked(progress, realm);
      return `<div class="${unlocked ? "ready" : ""}"><span>${realm.icon} ${realm.name}</span><b>${unlocked ? "Unlocked" : `${realm.xp} XP`}</b></div>`;
    }).join("");
  }

  function renderAchievements(progress) {
    const unlocked = achievements.filter((item) => progress.achievements[item.key]).length;
    document.getElementById("achievementCount").textContent = `${unlocked} / ${achievements.length} Unlocked`;
    document.getElementById("achievementList").innerHTML = achievements.map((item) => {
      const done = progress.achievements[item.key];
      return `
        <article class="achievement ${done ? "unlocked unlock-pop" : "locked"} ${item.rarity}">
          <div class="achievement-icon">${item.icon}</div>
          <div>
            <span class="achievement-category">${item.category} · ${item.rarity}</span>
            <h3>${item.title}</h3>
            <p>${item.text}</p>
            <div class="achievement-progress"><i style="width:${Math.round(item.progress(progress) * 100)}%"></i></div>
          </div>
          <strong>${done ? "Claimed" : item.reward}</strong>
        </article>
      `;
    }).join("");
  }

  function toast(message) {
    const node = document.getElementById("toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  }

  function renderDaily(progress) {
    const today = MagicStorage.todayKey();
    const done = progress.daily?.completedDate === today;
    document.getElementById("dailyStreak").textContent = progress.daily?.streak || 0;
    document.getElementById("dailyCompleted").textContent = done ? "Completed today" : "Ready";
    document.getElementById("dailyStatus").textContent = done ? "Reward claimed. Come back tomorrow." : "Reward: +80 XP and +2 bonus stars";
    document.getElementById("dailyChallengeButton").disabled = done;
    const eliteButton = document.getElementById("dailyEliteButton");
    if (eliteButton) eliteButton.disabled = progress.modes?.dailyEliteDate === today;
  }

  window.MagicUI = { realms, companions, spells, isRealmUnlocked, showView, renderRealms, renderProgress, renderDaily, secondsToClock, toast };
})();
