// Navigation, progression, fenêtre de détail d'une carte (avec les actions sur les doublons)
const App = (() => {
  let modal, modalCard, modalTitle, modalInfo, modalActions, toastEl, toastTimer;
  let currentView = "home";
  let modalAthlete = null;

  function show(view) {
    currentView = view;
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    rerenderView();
    window.scrollTo(0, 0);
    if (view === "binder") Quests.track("binder");
  }

  function rerenderView() {
    if (currentView === "home") Quests.render();
    if (currentView === "binder") Binder.render();
    if (currentView === "shop") Shop.render();
    if (currentView === "atelier") Atelier.render();
    if (currentView === "duel") Duel.render();
    if (currentView === "booster") Booster.refresh();
  }

  const setText = (id, v) => { document.getElementById(id).textContent = v; };

  function refreshProgress() {
    const owned = Store.uniqueOwned();
    const total = ATHLETES.length;
    setText("progress-text", `${owned} / ${total}`);
    document.getElementById("progress-bar").style.width = (owned / total) * 100 + "%";
    setText("packs-count", Store.packs);
    setText("coin-text", Store.coins);
    setText("stat-cards", owned);
    setText("stat-packs", Store.packs);
    setText("stat-coins", Store.coins);
    setText("stat-legend", ATHLETES.filter((a) => a.rarity === "L" && Store.count(a.id) > 0).length);
    setText("tile-binder-sub", `${owned} / ${total} cartes`);
    const res = Store.totalReserved();
    setText("tile-trade-sub", res ? `${res} carte${res > 1 ? "s" : ""} gardée${res > 1 ? "s" : ""} pour l'échange` : "Troque tes doublons");

    // Pastille sur "Menu" quand une quête attend sa récompense
    const pending = Quests.pendingCount();
    const badge = document.getElementById("menu-badge");
    badge.textContent = pending;
    badge.hidden = !pending;
    if (currentView === "home") Quests.render();
  }

  // ---------- Fenêtre détail + actions ----------
  function openModal(a, title) {
    modalAthlete = a;
    modalTitle.textContent = title || "";
    modalTitle.hidden = !title;
    renderModal(true);
    modal.hidden = false;
  }

  function renderModal(animate) {
    const a = modalAthlete;
    const r = RARITIES[a.rarity];
    modalCard.innerHTML = "";
    const card = createCard(a);
    if (!animate) card.style.animation = "none";
    enableTilt(card, 22);
    modalCard.appendChild(card);

    const n = Store.count(a.id), d = Store.dupes(a.id), res = Store.reserved(a.id), st = Store.stars(a.id);
    modalInfo.innerHTML =
      `${r.name} · ${sportOf(a).name}<br>` +
      `<span>Exemplaires <b>${n}</b></span><span>Doublons libres <b>${d}</b></span>` +
      `<span>Gardés pour échange <b>${res}</b></span><span>Étoiles <b>${st}/${MAX_STARS}</b></span>`;

    const maxed = st >= MAX_STARS;
    modalActions.innerHTML = `
      <button data-act="upgrade" ${!d || maxed ? "disabled" : ""}>⭐ Améliorer<small>${maxed ? "Niveau max atteint" : `1 doublon → ★${st + 1} (+1 ATT/DEF)`}</small></button>
      <button data-act="sell" ${!d ? "disabled" : ""}>🪙 Vendre 1 doublon<small>+${r.sell} pièces</small></button>
      <button data-act="reserve" ${!d ? "disabled" : ""}>🔄 Garder pour échange<small>Protégé de la vente et de la fusion</small></button>
      ${res ? `<button data-act="unreserve">↩ Retirer de l'échange<small>Redevient un doublon libre</small></button>` : ""}`;
    if (n <= 1) modalActions.innerHTML = `<p class="no-dupe">Pas de doublon pour cette carte. Ouvre des boosters pour en obtenir !</p>`;
  }

  function doAction(act) {
    const a = modalAthlete;
    let ok = false;
    if (act === "upgrade") ok = Store.upgrade(a.id);
    if (act === "sell") ok = Store.sellDupe(a.id, RARITIES[a.rarity].sell);
    if (act === "reserve") ok = Store.reserve(a.id);
    if (act === "unreserve") ok = Store.unreserve(a.id);
    if (!ok) return;
    Store.save();
    if (act === "sell" || act === "upgrade" || act === "reserve") Quests.track(act);
    refreshProgress();
    renderModal(false);
    rerenderView();
    if (act === "upgrade") toast(Store.stars(a.id) >= MAX_STARS ? "★★★★★ Carte au niveau maximum !" : "Carte améliorée !");
    if (act === "sell") toast(`+${RARITIES[a.rarity].sell} 🪙`);
  }

  function closeModal() { modal.hidden = true; }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function init() {
    Store.load();
    modal = document.getElementById("card-modal");
    modalCard = document.getElementById("modal-card");
    modalTitle = document.getElementById("modal-title");
    modalInfo = document.getElementById("modal-info");
    modalActions = document.getElementById("modal-actions");
    toastEl = document.getElementById("toast");

    document.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));
    document.querySelectorAll("[data-soon]").forEach((b) =>
      b.addEventListener("click", () => toast(`${b.dataset.soon} arrive bientôt !`)));
    const soundBtn = document.getElementById("sound-btn");
    const paintSound = () => {
      soundBtn.textContent = Sound.muted ? "🔇" : "🔊";
      soundBtn.classList.toggle("off", Sound.muted);
    };
    paintSound();
    soundBtn.addEventListener("click", () => { Sound.toggle(); paintSound(); toast(Sound.muted ? "Son coupé" : "Son activé"); });

    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    modalActions.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (b && !b.disabled) doAction(b.dataset.act);
    });
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("Effacer toute ta collection, tes pièces et tes boosters ?")) { Store.reset(); refreshProgress(); rerenderView(); }
    });

    Walkout.init();
    Booster.init();
    Binder.init();
    Shop.init();
    Atelier.init();
    Quests.init();
    Duel.init();
    refreshProgress();
    Quests.render();
  }

  return { init, refreshProgress, openModal, toast };
})();

document.addEventListener("DOMContentLoaded", App.init);
