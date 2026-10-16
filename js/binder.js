// Le classeur de collection : un onglet par sport, 9 cartes par page, 2 pages ouvertes
// + une recherche (nom, pays, sport, description) avec filtres, qui affiche les résultats de tous les sports.
const Binder = (() => {
  const PER_PAGE = 9;
  let sportIdx = 0;
  let spread = 0;
  let tabsEl, spreadEl, titleEl, countEl, pageEl, prevBtn, nextBtn, rewardEl;
  let searchEl, rarityEl, statusEl, ownedEl, clearBtn;
  const query = { text: "", rarity: "", status: "", owned: "" };

  const cardsOf = (sportId) => ATHLETES.filter((a) => a.sport === sportId);

  // ---------- Recherche ----------
  const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const searchCountry = (code) => countryName(code) + (UK_NATIONS[code] ? " Royaume-Uni" : "");

  // Texte dans lequel on cherche, calculé une seule fois par carte
  const haystack = new Map();
  function textOf(a) {
    if (!haystack.has(a.id)) {
      const s = sportOf(a);
      haystack.set(a.id, norm([a.name, s.name, a.discipline || "", searchCountry(a.country), a.desc, a.icon ? "icone" : ""].join(" ")));
    }
    return haystack.get(a.id);
  }

  const isSearching = () => !!(query.text || query.rarity || query.status || query.owned);

  function matches(a) {
    if (query.rarity && a.rarity !== query.rarity) return false;
    if (query.status === "icon" && !a.icon) return false;
    if (query.status === "active" && a.icon) return false;
    const n = Store.count(a.id);
    if (query.owned === "owned" && !n) return false;
    if (query.owned === "missing" && n) return false;
    if (query.owned === "shiny" && !Store.hasShiny(a.id)) return false;
    if (query.owned === "dupes" && !Store.dupes(a.id)) return false;
    if (query.owned === "trade" && !Store.reserved(a.id)) return false;
    if (query.text) {
      const t = textOf(a);
      return norm(query.text).split(/\s+/).filter(Boolean).every((w) => t.includes(w));
    }
    return true;
  }

  // Les résultats dont le NOM correspond passent avant ceux trouvés par la description
  function results() {
    const q = norm(query.text);
    return ATHLETES.filter(matches).sort((a, b) =>
      (q && norm(b.name).includes(q)) - (q && norm(a.name).includes(q)) || a.num - b.num);
  }

  function clearSearch() {
    Object.assign(query, { text: "", rarity: "", status: "", owned: "" });
    searchEl.value = rarityEl.value = statusEl.value = ownedEl.value = "";
  }

  // ---------- Affichage ----------
  function renderTabs() {
    tabsEl.innerHTML = "";
    tabsEl.classList.toggle("searching", isSearching());
    SPORTS.forEach((s, i) => {
      const list = cardsOf(s.id);
      const owned = list.filter((a) => Store.count(a.id) > 0).length;
      const b = document.createElement("button");
      b.className = "tab" + (i === sportIdx && !isSearching() ? " active" : "") + (owned === list.length ? " complete" : "") +
        (owned === list.length && !Store.isClaimed(s.id) ? " reward" : "");
      b.style.setProperty("--sport", s.color);
      b.innerHTML = `<span class="tab-icon">${s.icon}</span>${s.name}<small>${owned}/${list.length}</small>`;
      b.addEventListener("click", () => { clearSearch(); sportIdx = i; spread = 0; render(); });
      tabsEl.appendChild(b);
    });
  }

  // showName : en mode recherche, on affiche le nom des cartes manquantes
  function makeSlot(a, showName) {
    const slot = document.createElement("div");
    slot.className = "slot";
    if (!a) { slot.classList.add("slot-blank"); return slot; }

    const n = Store.count(a.id);
    if (n > 0) {
      slot.classList.add("owned");
      slot.appendChild(createCard(a));
      slot.insertAdjacentHTML("beforeend", slotBadges(a));
      slot.addEventListener("click", () => App.openModal(a));
    } else {
      const s = sportOf(a);
      slot.innerHTML = `<div class="slot-empty"><b>${String(a.num).padStart(3, "0")}</b><span>${s.icon}</span><em>${showName ? a.name : "???"}</em></div>`;
      if (showName) slot.classList.add("named");
    }
    return slot;
  }

  function renderSpread(dir) {
    const searching = isSearching();
    const s = SPORTS[sportIdx];
    const list = searching ? results() : cardsOf(s.id);
    const spreads = Math.max(1, Math.ceil(list.length / (PER_PAGE * 2)));
    spread = Math.min(Math.max(spread, 0), spreads - 1);

    spreadEl.innerHTML = "";
    if (searching && !list.length) {
      spreadEl.innerHTML = `<p class="no-result">Aucun sportif ne correspond à ta recherche.</p>`;
    } else {
      for (let p = 0; p < 2; p++) {
        const page = document.createElement("div");
        page.className = "page";
        const base = spread * PER_PAGE * 2 + p * PER_PAGE;
        for (let k = 0; k < PER_PAGE; k++) page.appendChild(makeSlot(list[base + k], searching));
        const num = document.createElement("div");
        num.className = "page-num";
        num.textContent = `${searching ? "Résultats" : s.name} — page ${spread * 2 + p + 1}`;
        page.appendChild(num);
        spreadEl.appendChild(page);
      }
    }

    const owned = list.filter((a) => Store.count(a.id) > 0).length;
    const shinies = list.filter((a) => Store.hasShiny(a.id)).length;
    if (searching) {
      titleEl.innerHTML = `<span>🔎</span> Résultats`;
      countEl.textContent = `${list.length} carte${list.length > 1 ? "s" : ""} trouvée${list.length > 1 ? "s" : ""} · ${owned} possédée${owned > 1 ? "s" : ""}`;
      rewardEl.hidden = true;
    } else {
      titleEl.innerHTML = `<span>${s.icon}</span> ${s.name}`;
      countEl.textContent = `${owned} / ${list.length} cartes` + (shinies ? ` · ✨ ${shinies} brillante${shinies > 1 ? "s" : ""}` : "");
      rewardEl.hidden = false;
      renderReward(s);
    }
    pageEl.textContent = `${spread + 1} / ${spreads}`;
    prevBtn.disabled = spread === 0;
    nextBtn.disabled = spread >= spreads - 1;
    clearBtn.hidden = !searching;

    if (dir) {
      spreadEl.classList.remove("turn-next", "turn-prev");
      void spreadEl.offsetWidth;
      spreadEl.classList.add(dir > 0 ? "turn-next" : "turn-prev");
    }
  }

  // Bandeau de récompense : visible quand la collection du sport est complète
  function renderReward(s) {
    if (!Rewards.isComplete(s.id) && !Store.isClaimed(s.id)) {
      const missing = cardsOf(s.id).filter((a) => Store.count(a.id) === 0).length;
      rewardEl.className = "binder-reward locked";
      rewardEl.innerHTML = `🏆 Complète cette collection pour gagner <b>${Rewards.coinsFor(s.id)} 🪙</b> + 1 ${packInfo(SPORT_REWARD_BOOSTER).name} <small>(encore ${missing} carte${missing > 1 ? "s" : ""})</small>`;
      return;
    }
    if (Store.isClaimed(s.id)) {
      rewardEl.className = "binder-reward done";
      rewardEl.innerHTML = `🏆 Collection ${s.name} complète — récompense récupérée`;
      return;
    }
    rewardEl.className = "binder-reward ready";
    rewardEl.innerHTML = `🏆 Collection complète ! <button class="btn btn-yellow">Récupérer ${Rewards.coinsFor(s.id)} 🪙 + 1 ${packInfo(SPORT_REWARD_BOOSTER).name}</button>`;
    rewardEl.querySelector("button").addEventListener("click", () => { if (Rewards.claim(s.id)) render(); });
  }

  function render(dir) {
    renderTabs();
    renderSpread(dir);
  }

  function init() {
    tabsEl = document.getElementById("binder-tabs");
    spreadEl = document.getElementById("spread");
    titleEl = document.getElementById("binder-title");
    countEl = document.getElementById("binder-count");
    pageEl = document.getElementById("page-indicator");
    prevBtn = document.getElementById("prev-page");
    nextBtn = document.getElementById("next-page");
    rewardEl = document.getElementById("binder-reward");
    searchEl = document.getElementById("search-text");
    rarityEl = document.getElementById("f-rarity");
    statusEl = document.getElementById("f-status");
    ownedEl = document.getElementById("f-owned");
    clearBtn = document.getElementById("search-clear");

    rarityEl.innerHTML = `<option value="">Toutes les raretés</option>` +
      RARITY_ORDER.map((c) => `<option value="${c}">${RARITIES[c].name}</option>`).join("");

    prevBtn.addEventListener("click", () => { spread--; renderSpread(-1); });
    nextBtn.addEventListener("click", () => { spread++; renderSpread(1); });

    let timer;
    searchEl.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { query.text = searchEl.value.trim(); spread = 0; render(); }, 150);
    });
    [[rarityEl, "rarity"], [statusEl, "status"], [ownedEl, "owned"]].forEach(([el, key]) =>
      el.addEventListener("change", () => { query[key] = el.value; spread = 0; render(); }));
    clearBtn.addEventListener("click", () => { clearSearch(); spread = 0; render(); });
  }

  return { init, render };
})();
