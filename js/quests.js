// Quêtes du jour + récompenses de collection complète
const Quests = (() => {
  let listEl, resetEl;

  // Tirage des quêtes du jour : même tirage pour toute la journée (graine = date)
  function todays() {
    let seed = [...Store.today()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const pool = [...QUEST_POOL].sort(() => rand() - 0.5);
    const picked = [];
    for (const q of pool) {
      if (picked.length >= DAILY_QUEST_COUNT) break;
      if (!picked.some((p) => p.event === q.event)) picked.push(q);
    }
    return picked;
  }

  const isDone = (q) => Store.dailyProgress(q.event) >= q.goal;

  // À appeler à chaque action du joueur ("open", "new", "rare", "sell", "upgrade", "fuse", "reserve", "binder")
  function track(event, n = 1) {
    if (n <= 0) return;
    const before = todays().filter(isDone).map((q) => q.id);
    Store.track(event, n);
    Store.save();
    todays().filter((q) => isDone(q) && !before.includes(q.id))
      .forEach((q) => App.toast(`🎯 Quête terminée : ${q.text} ! Récupère ta récompense au menu`));
    App.refreshProgress();
  }

  function claim(q) {
    if (!isDone(q) || Store.questClaimed(q.id)) return;
    Store.setQuestClaimed(q.id);
    Store.addCoins(q.reward);
    Store.save();
    App.refreshProgress();
    App.toast(`+${q.reward} 🪙`);
    render();
  }

  function updateReset() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const min = Math.ceil((midnight - now) / 60000);
    resetEl.textContent = `Nouvelles quêtes dans ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  }

  function render() {
    listEl.innerHTML = "";
    todays().forEach((q) => {
      const p = Math.min(q.goal, Store.dailyProgress(q.event));
      const claimed = Store.questClaimed(q.id);
      const row = document.createElement("div");
      row.className = "quest" + (claimed ? " claimed" : "");
      row.innerHTML = `
        <div class="quest-text">${q.text}<small>${p} / ${q.goal}</small></div>
        <div class="quest-bar"><i style="width:${(p / q.goal) * 100}%"></i></div>
        <button class="btn ${p >= q.goal && !claimed ? "btn-yellow" : ""}" ${p < q.goal || claimed ? "disabled" : ""}>
          ${claimed ? "✓ Reçu" : `+${q.reward} 🪙`}
        </button>`;
      row.querySelector("button").addEventListener("click", () => claim(q));
      listEl.appendChild(row);
    });
    updateReset();
  }

  function pendingCount() {
    return todays().filter((q) => isDone(q) && !Store.questClaimed(q.id)).length;
  }

  function init() {
    listEl = document.getElementById("quest-list");
    resetEl = document.getElementById("quest-reset");
    let day = Store.today();
    setInterval(() => {
      updateReset();
      if (day !== Store.today()) { day = Store.today(); render(); }
    }, 30000);
  }

  return { init, render, track, pendingCount };
})();

// Récompense quand toutes les cartes d'un sport sont dans le classeur
const Rewards = (() => {
  const cardsOf = (sport) => ATHLETES.filter((a) => a.sport === sport);
  const isComplete = (sport) => cardsOf(sport).every((a) => Store.count(a.id) > 0);
  const coinsFor = (sport) => cardsOf(sport).length * SPORT_REWARD_PER_CARD;
  const completedSports = () => SPORTS.filter((s) => isComplete(s.id)).map((s) => s.id);

  function claim(sport) {
    if (!isComplete(sport) || Store.isClaimed(sport)) return false;
    Store.setClaimed(sport);
    Store.addCoins(coinsFor(sport));
    Store.giveBooster(SPORT_REWARD_BOOSTER);
    Store.save();
    App.refreshProgress();
    App.toast(`🏆 +${coinsFor(sport)} 🪙 et 1 ${packInfo(SPORT_REWARD_BOOSTER).name} !`);
    return true;
  }

  return { isComplete, coinsFor, completedSports, claim };
})();
