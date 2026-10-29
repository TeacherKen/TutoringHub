(function () {
  let audioContext;
  let frameId;
  let lastFrame = 0;
  let particles = [];
  let settings = {
    animationIntensity: 100,
    particleIntensity: 75,
    soundVolume: 70,
    musicVolume: 45,
    reducedMotion: false
  };
  let muted = false;
  const transientLimit = 90;

  function configure(next = {}, isMuted = false) {
    settings = { ...settings, ...next };
    muted = isMuted;
    rebuildParticles();
  }

  function desiredCount() {
    if (settings.reducedMotion || settings.animationIntensity < 20) return 0;
    return Math.round(18 + (settings.particleIntensity / 100) * 72);
  }

  function newParticle(index) {
    const palettes = {
      frost: [186, 206, 220],
      blue: [186, 206, 220],
      orange: [16, 36, 48],
      dragon: [16, 34, 48],
      storm: [190, 210, 235],
      stormboss: [190, 210, 235],
      green: [110, 148, 180],
      emerald: [110, 155, 190],
      void: [265, 284, 310],
      oracle: [265, 284, 310],
      shadow: [265, 284, 310],
      chaos: [280, 308, 328]
    };
    const realm = document.body.dataset.realm || "cyan";
    const hues = palettes[realm] || [190, 225, 272];
    return {
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2.8 + 0.5,
      speed: Math.random() * 0.18 + 0.035,
      drift: Math.random() * 4 + index,
      hue: hues[index % hues.length] + Math.random() * 12 - 6
    };
  }

  function rebuildParticles() {
    const count = desiredCount();
    if (particles.length > count) particles.length = count;
    while (particles.length < count) particles.push(newParticle(particles.length));
  }

  function initParticles() {
    const canvas = document.getElementById("particles");
    if (!canvas || frameId) return;
    const ctx = canvas.getContext("2d", { alpha: true });

    function resize() {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.dataset.ratio = ratio;
    }

    function draw(time) {
      frameId = requestAnimationFrame(draw);
      if (time - lastFrame < 30) return;
      lastFrame = time;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!particles.length) return;
      const ratio = Number(canvas.dataset.ratio) || 1;
      particles.forEach((particle) => {
        particle.y -= particle.speed / 100;
        particle.x += Math.sin(time / 1800 + particle.drift) * 0.00028;
        if (particle.y < -0.05) Object.assign(particle, newParticle(Math.floor(Math.random() * 20)), { y: 1.05 });
        ctx.beginPath();
        ctx.fillStyle = `hsla(${particle.hue}, 95%, 72%, .72)`;
        ctx.shadowColor = `hsl(${particle.hue}, 95%, 65%)`;
        ctx.shadowBlur = 12 * ratio;
        ctx.arc(particle.x * canvas.width, particle.y * canvas.height, particle.size * ratio, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();
    rebuildParticles();
    frameId = requestAnimationFrame(draw);
  }

  function addTransient(node, duration) {
    const layer = document.getElementById("fxLayer") || document.body;
    while (layer.children.length >= transientLimit) layer.firstElementChild.remove();
    layer.appendChild(node);
    setTimeout(() => node.remove(), duration);
  }

  function tone(frequency, duration = 0.08, forceMuted = muted, character = "sine", channel = "sfx") {
    if (forceMuted || muted || (settings.soundVolume || 0) <= 0) return;
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = character;
    oscillator.frequency.value = frequency;
    const level = channel === "music" ? settings.musicVolume : settings.soundVolume;
    const volume = Math.max(0.002, (level / 100) * 0.045);
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function burst(x, y, toneName = "rune", count = 14) {
    if (settings.reducedMotion || settings.animationIntensity < 20) return;
    const amount = Math.max(4, Math.round(count * settings.particleIntensity / 100));
    for (let i = 0; i < amount; i += 1) {
      const spark = document.createElement("i");
      spark.className = `spark ${toneName}`;
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      spark.style.setProperty("--a", `${Math.random() * 360}deg`);
      spark.style.setProperty("--d", `${32 + Math.random() * 58}px`);
      addTransient(spark, 760);
    }
  }

  function centerBurst(toneName, count) {
    burst(window.innerWidth / 2, window.innerHeight / 2, toneName, count);
  }

  function transition(kind = "screen") {
    const veil = document.getElementById("sceneTransition");
    if (!veil || settings.reducedMotion || settings.animationIntensity < 20) return;
    veil.className = `scene-transition active ${kind}`;
    clearTimeout(transition.timer);
    transition.timer = setTimeout(() => { veil.className = "scene-transition"; }, kind === "realm" ? 720 : 470);
  }

  function setRealmAtmosphere(realm, boss = false) {
    document.body.dataset.realm = realm || "default";
    document.body.classList.toggle("encounter-atmosphere", boss);
    rebuildParticles();
    if (boss) ambientCue(realm);
  }

  function ambientCue(realm) {
    if (muted || (settings.musicVolume || 0) <= 0) return;
    const note = { frost: 196, chaos: 130, dragon: 110, oracle: 98, stormboss: 146, storm: 146 }[realm] || 174;
    tone(note, 0.34, false, "triangle", "music");
  }

  function impact(kind = "hit", strength = 1) {
    const flash = document.getElementById("impactFlash");
    if (!flash) return;
    flash.className = `impact-flash active ${kind}`;
    if (!settings.reducedMotion && settings.animationIntensity >= 45) {
      document.body.classList.add(strength > 1 ? "screen-shake-heavy" : "screen-shake");
    }
    clearTimeout(impact.timer);
    impact.timer = setTimeout(() => {
      flash.className = "impact-flash";
      document.body.classList.remove("screen-shake", "screen-shake-heavy");
    }, strength > 1 ? 360 : 240);
  }

  function spell(key, anchor) {
    const rect = anchor?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    burst(x, y, key, key === "fireball" || key === "blast" ? 28 : 16);
    impact(key === "shield" ? "shield" : "magic", key === "fireball" || key === "blast" ? 1 : 0);
  }

  function combo(value) {
    if (value < 3) return;
    centerBurst("combo", Math.min(36, 12 + value * 4));
    impact("combo", value >= 5 ? 2 : 1);
    tone(520 + value * 35, 0.1, muted, "triangle");
  }

  function phase(phaseNumber) {
    transition("boss");
    centerBurst("rage", 34);
    impact("rage", phaseNumber >= 3 ? 2 : 1);
    tone(80 + phaseNumber * 32, 0.38, muted, "sawtooth");
  }

  function reward() {
    centerBurst("reward", 42);
    impact("reward", 1);
  }

  function mana() {
    document.querySelector(".mana-chip")?.classList.add("charged");
    clearTimeout(mana.timer);
    mana.timer = setTimeout(() => document.querySelector(".mana-chip")?.classList.remove("charged"), 560);
  }

  function lowHp(active) {
    document.body.classList.toggle("low-hp", !!active);
  }

  function completeLoading() {
    const loading = document.getElementById("loadingScreen");
    if (!loading) return;
    requestAnimationFrame(() => loading.classList.add("ready"));
    setTimeout(() => loading.remove(), settings.reducedMotion ? 10 : 700);
  }

  window.MagicEffects = {
    ambientCue,
    burst,
    combo,
    completeLoading,
    configure,
    impact,
    initParticles,
    lowHp,
    mana,
    phase,
    reward,
    setRealmAtmosphere,
    spell,
    tone,
    transition
  };
})();
