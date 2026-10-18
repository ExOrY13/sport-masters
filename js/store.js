// Sauvegarde de la collection dans le navigateur (localStorage)
//  owned[id]    = nombre total d'exemplaires (la carte du classeur + les doublons)
//  reserved[id] = doublons mis de côté pour les échanges (non vendables, non fusionnables)
//  stars[id]    = niveau d'amélioration (0 à MAX_STARS)
//  inventory    = boosters achetés pas encore ouverts { "elite": 2, "sport:foot": 1 }
const Store = (() => {
  const KEY = "sportmasters_save_v2"; // v2 : les cartes sont repérées par un identifiant fixe
  const blank = () => ({ owned: {}, packs: 0, coins: 0, stars: {}, reserved: {}, inventory: {},
                         freePacks: FREE_PACK_MAX, freeTick: Date.now(),
                         shiny: {}, claimed: {}, daily: { date: "", progress: {}, claimed: {} },
                         duels: { played: 0, won: 0 } });

  // Date du jour en heure locale (les quêtes changent à minuit)
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  function ensureDaily() {
    if (state.daily.date !== today()) state.daily = { date: today(), progress: {}, claimed: {} };
  }
  let state = blank();

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.owned) state = Object.assign(blank(), s);
    } catch (e) { /* stockage indisponible : on joue sans sauvegarde */ }
  }

  // Appelé après chaque sauvegarde (synchronisation en ligne quand le joueur est connecté)
  let onSave = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (onSave) onSave();
  }

  // Remplace toute la sauvegarde (chargement d'un compte en ligne)
  function replace(s) {
    state = Object.assign(blank(), s && s.owned ? s : {});
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  const count = (id) => state.owned[id] || 0;
  const reserved = (id) => state.reserved[id] || 0;
  const stars = (id) => state.stars[id] || 0;
  const dupes = (id) => Math.max(0, count(id) - 1 - reserved(id)); // doublons libres

  function removeCopy(id) { state.owned[id]--; }

  // Boosters gratuits : +1 toutes les FREE_PACK_INTERVAL, jusqu'à FREE_PACK_MAX.
  // freeTick = moment à partir duquel le prochain booster se recharge.
  function refill() {
    const now = Date.now();
    if (state.freePacks >= FREE_PACK_MAX) { state.freeTick = now; return; }
    const n = Math.floor((now - state.freeTick) / FREE_PACK_INTERVAL);
    if (n <= 0) return;
    state.freePacks = Math.min(FREE_PACK_MAX, state.freePacks + n);
    state.freeTick = state.freePacks >= FREE_PACK_MAX ? now : state.freeTick + n * FREE_PACK_INTERVAL;
  }

  return {
    load, save, replace, count, reserved, stars, dupes,
    exportState: () => JSON.parse(JSON.stringify(state)),
    isEmpty: () => !state.packs && !Object.keys(state.owned).length,
    set onSave(fn) { onSave = fn; },
    add(id) { state.owned[id] = count(id) + 1; },

    get coins() { return state.coins; },
    addCoins(n) { state.coins += n; },

    // Version Brillante : une fois obtenue, la carte s'affiche brillante dans la collection
    hasShiny: (id) => !!state.shiny[id],
    setShiny(id) { state.shiny[id] = true; },

    // Récompense de collection complète, une fois par sport
    isClaimed: (sport) => !!state.claimed[sport],
    setClaimed(sport) { state.claimed[sport] = true; },

    // Quêtes du jour
    today,
    dailyProgress(event) { ensureDaily(); return state.daily.progress[event] || 0; },
    track(event, n = 1) { ensureDaily(); state.daily.progress[event] = (state.daily.progress[event] || 0) + n; },
    questClaimed(qid) { ensureDaily(); return !!state.daily.claimed[qid]; },
    setQuestClaimed(qid) { ensureDaily(); state.daily.claimed[qid] = true; },
    spend(n) {
      if (state.coins < n) return false;
      state.coins -= n;
      return true;
    },

    sellDupe(id, price) {
      if (dupes(id) < 1) return false;
      removeCopy(id);
      state.coins += price;
      return true;
    },
    upgrade(id) {
      if (dupes(id) < 1 || stars(id) >= MAX_STARS) return false;
      removeCopy(id);
      state.stars[id] = stars(id) + 1;
      return true;
    },
    reserve(id) {
      if (dupes(id) < 1) return false;
      state.reserved[id] = reserved(id) + 1;
      return true;
    },
    unreserve(id) {
      if (reserved(id) < 1) return false;
      state.reserved[id]--;
      return true;
    },
    consumeDupe(id) {
      if (dupes(id) < 1) return false;
      removeCopy(id);
      return true;
    },

    freePacks() { refill(); return state.freePacks; },
    useFree() {
      refill();
      if (state.freePacks < 1) return false;
      state.freePacks--;
      return true;
    },
    nextFreeIn() { // millisecondes avant le prochain booster gratuit (0 si la réserve est pleine)
      refill();
      return state.freePacks >= FREE_PACK_MAX ? 0 : FREE_PACK_INTERVAL - (Date.now() - state.freeTick);
    },
    giveFree(n) { state.freePacks = Math.min(FREE_PACK_MAX, state.freePacks + n); },

    get duels() { return state.duels; },
    recordDuel(won) { state.duels.played++; if (won) state.duels.won++; },

    get packs() { return state.packs; },
    addPack() { state.packs++; },
    packCount: (key) => state.inventory[key] || 0,
    giveBooster(key) { state.inventory[key] = (state.inventory[key] || 0) + 1; },
    useBooster(key) {
      if (!state.inventory[key]) return false;
      state.inventory[key]--;
      return true;
    },
    ownedBoosters: () => Object.keys(state.inventory).filter((k) => state.inventory[k] > 0),

    uniqueOwned() { return Object.keys(state.owned).filter((k) => state.owned[k] > 0).length; },
    totalReserved() { return Object.values(state.reserved).reduce((s, n) => s + n, 0); },
    reset() { state = blank(); save(); },
  };
})();
