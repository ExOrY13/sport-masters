// Ouverture des boosters + animation spéciale (Ultra rare / Légendaire)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const Walkout = (() => {
  let el, timers = [], phase = "", resolveFn = null, big = false;

  function init() {
    el = document.getElementById("walkout");
    el.addEventListener("click", () => {
      if (phase === "card") close();
      else if (phase) showCard();
    });
  }

  function makeParticles(rarity) {
    const box = el.querySelector(".wo-particles");
    box.innerHTML = "";
    const colors = rarity === "S" ? ["#ff4fd8", "#b06bff", "#7ee8ff", "#ffffff"]
      : rarity === "L" ? ["#ff3cac", "#ffd200", "#2bd2ff", "#a66bff", "#ffffff"] : ["#ffd84d", "#fff3b0", "#ffb300"];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement("span");
      const c = colors[i % colors.length];
      p.style.cssText = `--x:${Math.random() * 100}%;--s:${3 + Math.random() * 6}px;--d:${2.5 + Math.random() * 3}s;--delay:${-Math.random() * 5}s;--pc:${c}`;
      box.appendChild(p);
    }
  }

  function setPhase(p) {
    phase = p;
    el.classList.remove("p-flag", "p-sport", "p-card");
    if (p !== "beam") el.classList.add("p-" + p);
    Sound.walkout(p, big);
  }

  function showCard() {
    timers.forEach(clearTimeout);
    timers = [];
    setPhase("card");
  }

  function close() {
    phase = "";
    el.classList.add("closing");
    setTimeout(() => {
      el.hidden = true;
      el.className = "walkout";
      if (resolveFn) resolveFn();
      resolveFn = null;
    }, 350);
  }

  // opts.shiny : animation arc-en-ciel pour une carte Brillante, quelle que soit sa rareté
  function play(a, opts = {}) {
    return new Promise((resolve) => {
      resolveFn = resolve;
      big = a.rarity === "L" || a.rarity === "S" || !!opts.shiny;
      const s = sportOf(a);
      el.className = "walkout wo-" + (opts.shiny && a.rarity !== "S" ? "L wo-shiny" : a.rarity);
      el.querySelector(".wo-flag img").src = `https://flagcdn.com/w320/${a.country}.png`;
      el.querySelector(".wo-sport .icon").textContent = s.icon;
      el.querySelector(".wo-sport .label").textContent = a.discipline || s.name;
      const title = a.rarity === "S" ? "Carte secrète" + (opts.shiny ? " · Brillante" : "")
        : (opts.shiny ? "✨ Brillante · " : "") + RARITIES[a.rarity].name + (a.icon ? " · Icône" : "");
      el.querySelector(".wo-title").textContent = title;
      el.querySelector(".wo-title").classList.toggle("long", title.length > 18);
      const holder = el.querySelector(".wo-card");
      holder.innerHTML = "";
      const card = createCard(a, { shiny: !!opts.shiny });
      enableTilt(card, 22);
      holder.appendChild(card);
      makeParticles(a.rarity === "S" ? "S" : opts.shiny ? "L" : a.rarity);

      el.hidden = false;
      setPhase("beam");
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
      timers = [
        setTimeout(() => setPhase("flag"), 1100),
        setTimeout(() => setPhase("sport"), 2300),
        setTimeout(showCard, 3500),
      ];
    });
  }

  return { init, play };
})();

const Booster = (() => {
  let entries = [];
  let opening = false;
  let forced = null; // pour tester : Shift+L / Shift+U
  let current = "standard";
  let forcedShiny = false; // pour tester : Shift+S
  let newlyComplete = [];  // sports complétés grâce à ce booster
  let pack, intro, reveal, row, btnAll, btnAgain, choicesEl;

  function pickRarity(minRank = 0) {
    const pool = RARITY_ORDER.filter((c) => RARITIES[c].rank >= minRank);
    const total = pool.reduce((sum, c) => sum + RARITIES[c].weight, 0);
    let x = Math.random() * total;
    for (const c of pool) {
      x -= RARITIES[c].weight;
      if (x <= 0) return c;
    }
    return pool[pool.length - 1];
  }

  const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

  // Jamais deux fois le même sportif dans un booster.
  // Si la rareté n'existe pas (ex : pas de Légendaire en rugby), on prend la plus proche.
  function pickAthlete(rarity, used, sport) {
    const pool = ATHLETES.filter((a) => !used.has(a.id) && (!sport || a.sport === sport));
    const exact = pool.filter((a) => a.rarity === rarity);
    if (exact.length) return pickOne(exact);
    const target = RARITIES[rarity].rank;
    const dist = (a) => Math.abs(RARITIES[a.rarity].rank - target);
    const best = Math.min(...pool.map(dist));
    return pickOne(pool.filter((a) => dist(a) === best));
  }

  function generate(info) {
    const cards = [];
    const used = new Set();
    info.minRanks.forEach((minRank, i) => {
      let rar = pickRarity(minRank);
      if (i === 4 && forced) { rar = forced; forced = null; }
      const a = pickAthlete(rar, used, info.sport);
      used.add(a.id);
      cards.push(a);
    });
    return cards.sort((a, b) => RARITIES[a.rarity].rank - RARITIES[b.rarity].rank);
  }

  // Choix du booster à ouvrir : le Standard (gratuit) + ceux achetés en boutique
  function renderChoices() {
    const keys = ["standard", ...Store.ownedBoosters()];
    if (!keys.includes(current)) current = "standard";
    choicesEl.innerHTML = "";
    keys.forEach((k) => {
      const info = packInfo(k);
      const b = document.createElement("button");
      b.className = "pack-choice" + (k === current ? " active" : "");
      b.innerHTML = k === "standard"
        ? `${info.name} <small class="free-count">${Store.freePacks()}/${FREE_PACK_MAX}</small>`
        : `${info.name} <small>×${Store.packCount(k)}</small>`;
      b.addEventListener("click", () => select(k));
      choicesEl.appendChild(b);
    });

    const info = packInfo(current);
    const variant = current.startsWith("sport:") ? "sport" : current;
    pack.className = "pack pack-" + variant;
    const s = info.sport && SPORTS.find((x) => x.id === info.sport);
    if (s) pack.style.setProperty("--pk2", s.color); else pack.style.removeProperty("--pk2");
    pack.querySelector(".pack-label").textContent = info.label;
    pack.querySelector(".pack-icons").textContent = s ? s.icon : "⚽ 🏀 🎾 🏎️ 🥊";
    document.getElementById("pack-desc").textContent = info.desc;
    updateTimer();
  }

  const fmt = (ms) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // Appelé chaque seconde : compteur de boosters gratuits + compte à rebours
  function updateTimer() {
    const free = Store.freePacks();
    const wait = Store.nextFreeIn();
    const timerText = wait ? `+1 dans ${fmt(wait)}` : "réserve pleine";

    document.getElementById("free-timer").innerHTML =
      `🎁 <b>${free}/${FREE_PACK_MAX}</b> boosters gratuits · ${timerText}`;
    document.getElementById("tile-booster-sub").textContent = `${free}/${FREE_PACK_MAX} gratuits · ${timerText}`;
    const countEl = choicesEl.querySelector(".free-count");
    if (countEl) countEl.textContent = `${free}/${FREE_PACK_MAX}`;

    if (opening) return;
    const empty = current === "standard" && free < 1;
    pack.classList.toggle("empty", empty);
    document.getElementById("pack-hint").textContent = empty
      ? `Plus de booster gratuit : le prochain arrive dans ${fmt(wait)}. Tu peux aussi en acheter en Boutique !`
      : "Clique sur le booster pour l'ouvrir";
  }

  function select(key) {
    current = key;
    renderChoices();
  }

  function open() {
    if (opening) return;
    if (current === "standard" ? !Store.useFree() : !Store.useBooster(current)) return;
    opening = true;
    const info = packInfo(current);

    const completeBefore = Rewards.completedSports();
    entries = generate(info).map((a, i) => {
      const isNew = Store.count(a.id) === 0;
      const shiny = Math.random() < SHINY_RATE || (forcedShiny && i === 4);
      Store.add(a.id);
      if (shiny) Store.setShiny(a.id);
      return { a, isNew, shiny, flipped: false };
    });
    forcedShiny = false;
    newlyComplete = Rewards.completedSports().filter((s) => !completeBefore.includes(s));
    Store.addPack();
    Store.save();
    Quests.track("open");
    Quests.track("new", entries.filter((e) => e.isNew).length);
    Quests.track("rare", entries.filter((e) => RARITIES[e.a.rarity].rank >= 2).length);

    // Le booster brille une fois s'il contient une Super rare ou mieux, puis se déchire en haut
    const best = entries[entries.length - 1].a.rarity;
    const glow = RARITIES[best].rank >= 3;
    pack.classList.add("opening");
    if (glow) { pack.classList.add("glow-" + best); Sound.glow(); }
    const tearAt = glow ? 1000 : 100;
    setTimeout(() => { pack.classList.add("torn"); Sound.tear(); }, tearAt);
    setTimeout(() => pack.classList.add("done"), tearAt + 750);
    setTimeout(showReveal, tearAt + 1100);
  }

  function showReveal() {
    intro.hidden = true;
    reveal.hidden = false;
    btnAll.hidden = false;
    btnAgain.hidden = true;
    row.innerHTML = "";

    entries.forEach((e, i) => {
      const slot = document.createElement("div");
      slot.className = "deal-slot";
      slot.style.setProperty("--i", i);
      const card = createCard(e.a, { faceDown: true, shiny: e.shiny });
      if (e.shiny) card.classList.add("hint-L");
      else if (RARITIES[e.a.rarity].rank >= 3) card.classList.add("hint-" + e.a.rarity);
      const tag = document.createElement("div");
      tag.className = "deal-tag " + (e.shiny ? "tag-shiny" : e.isNew ? "tag-new" : "tag-dup");
      tag.textContent = e.shiny ? (e.isNew ? "✨ NOUVELLE BRILLANTE !" : "✨ BRILLANTE !") : e.isNew ? "NOUVELLE !" : "Doublon";
      slot.append(card, tag);
      row.appendChild(slot);
      e.slot = slot;
      e.card = card;
      card.addEventListener("click", () => (e.flipped ? App.openModal(e.a) : revealCard(e)));
    });
  }

  async function revealCard(e) {
    if (e.flipped) return;
    e.flipped = true;
    if (RARITIES[e.a.rarity].rank >= 4 || e.shiny) await Walkout.play(e.a, { shiny: e.shiny });
    else Sound.flip();
    e.card.classList.remove("face-down");
    e.card.classList.forEach((c) => c.startsWith("hint-") && e.card.classList.remove(c));
    e.slot.classList.add("revealed", "burst-" + (e.shiny ? "L" : e.a.rarity));
    enableTilt(e.card);
    if (entries.every((x) => x.flipped)) {
      btnAll.hidden = true;
      btnAgain.hidden = false;
      newlyComplete.forEach((id) => {
        const s = SPORTS.find((x) => x.id === id);
        App.toast(`🏆 Collection ${s.name} complète ! Récupère ta récompense dans le classeur`);
      });
      newlyComplete = [];
    }
  }

  async function revealAll() {
    btnAll.hidden = true;
    for (const e of entries) {
      if (e.flipped) continue;
      await revealCard(e);
      await sleep(380);
    }
  }

  function reset() {
    reveal.hidden = true;
    intro.hidden = false;
    opening = false;
    renderChoices();
  }

  function renderRates() {
    const box = document.getElementById("rates");
    box.innerHTML = RARITY_ORDER.map((c) => {
      const n = ATHLETES.filter((a) => a.rarity === c).length;
      if (c === "S") return `<span class="rate r-S"><i>?</i>??? <small>??? % · ??? cartes</small></span>`; // on garde le mystère
      return `<span class="rate r-${c}"><i>${c}</i>${RARITIES[c].name} <small>${RARITIES[c].weight}% · ${n} cartes</small></span>`;
    }).join("");
  }

  function init() {
    pack = document.getElementById("pack");
    intro = document.getElementById("booster-intro");
    reveal = document.getElementById("reveal");
    row = document.getElementById("reveal-row");
    btnAll = document.getElementById("btn-reveal-all");
    btnAgain = document.getElementById("btn-again");
    choicesEl = document.getElementById("pack-choices");
    pack.addEventListener("click", open);
    btnAll.addEventListener("click", revealAll);
    btnAgain.addEventListener("click", reset);
    renderRates();
    renderChoices();
    setInterval(updateTimer, 1000);

    document.addEventListener("keydown", (ev) => {
      if (!ev.shiftKey) return;
      if (ev.key === "L") { forced = "L"; App.toast("Test : prochain booster avec une Légendaire"); }
      if (ev.key === "U") { forced = "UR"; App.toast("Test : prochain booster avec une Ultra rare"); }
      if (ev.key === "Z") { forced = "S"; App.toast("Test : prochain booster avec une carte secrète"); }
      if (ev.key === "S") { forcedShiny = true; App.toast("Test : prochain booster avec une Brillante"); }
      if (ev.key === "B") { Store.giveFree(FREE_PACK_MAX); Store.save(); updateTimer(); App.toast("Test : réserve de boosters gratuits remplie"); }
    });
  }

  // appelé quand on arrive sur l'écran Boosters (ex : après un achat)
  function refresh() { if (!opening) renderChoices(); }

  return { init, select, refresh };
})();
