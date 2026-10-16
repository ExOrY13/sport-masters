// Atelier : fusion de doublons + vue de tous les doublons + vente groupée
const Atelier = (() => {
  let fusionEl, dupesEl, sellAllBtn;

  const dupesOfRarity = (code) =>
    ATHLETES.filter((a) => a.rarity === code).reduce((s, a) => s + Store.dupes(a.id), 0);

  function sellAllValue() {
    return ATHLETES.reduce((s, a) => s + Store.dupes(a.id) * RARITIES[a.rarity].sell, 0);
  }

  function renderFusion() {
    fusionEl.innerHTML = "";
    // de Commun jusqu'à Légendaire : les cartes Secrètes ne s'obtiennent qu'en booster
    RARITY_ORDER.slice(0, RARITY_ORDER.indexOf("L")).forEach((code, i) => {
      const next = RARITY_ORDER[i + 1];
      const have = dupesOfRarity(code);
      const row = document.createElement("div");
      row.className = "fusion-row";
      row.innerHTML = `
        <span class="rate r-${code}"><i>${code}</i>${FUSION_COST} × ${RARITIES[code].name}</span>
        <span class="fusion-arrow">➜</span>
        <span class="rate r-${next}"><i>${next}</i>1 × ${RARITIES[next].name}</span>
        <span class="fusion-have">${have} doublon${have > 1 ? "s" : ""} dispo</span>
        <button class="btn">Fusionner</button>`;
      const btn = row.querySelector("button");
      btn.disabled = have < FUSION_COST;
      btn.addEventListener("click", () => fuse(code, next));
      fusionEl.appendChild(row);
    });
  }

  // On consomme d'abord les cartes dont on a le plus de doublons
  function fuse(code, next) {
    if (dupesOfRarity(code) < FUSION_COST) return;
    for (let n = 0; n < FUSION_COST; n++) {
      const top = ATHLETES.filter((a) => a.rarity === code && Store.dupes(a.id) > 0)
        .sort((a, b) => Store.dupes(b.id) - Store.dupes(a.id))[0];
      Store.consumeDupe(top.id);
    }
    const pool = ATHLETES.filter((a) => a.rarity === next);
    const fresh = pool.filter((a) => Store.count(a.id) === 0);
    const list = fresh.length ? fresh : pool;
    const won = list[Math.floor(Math.random() * list.length)];
    Store.add(won.id);
    Store.save();
    Quests.track("fuse");
    render();

    const title = fresh.length ? "Fusion réussie : nouvelle carte !" : "Fusion réussie";
    if (RARITIES[next].rank >= 4) Walkout.play(won).then(() => App.openModal(won, title));
    else App.openModal(won, title);
  }

  function renderDupes() {
    dupesEl.innerHTML = "";
    const list = ATHLETES.filter((a) => Store.dupes(a.id) > 0 || Store.reserved(a.id) > 0)
      .sort((a, b) => RARITIES[b.rarity].rank - RARITIES[a.rarity].rank);
    if (!list.length) {
      dupesEl.innerHTML = `<p class="empty-note">Aucun doublon pour l'instant. Ouvre des boosters !</p>`;
      return;
    }
    list.forEach((a) => {
      const slot = document.createElement("div");
      slot.className = "slot owned";
      slot.appendChild(createCard(a));
      slot.insertAdjacentHTML("beforeend", slotBadges(a));
      slot.addEventListener("click", () => App.openModal(a));
      dupesEl.appendChild(slot);
    });
  }

  function sellAll() {
    const value = sellAllValue();
    if (!value) return;
    if (!confirm(`Vendre tous tes doublons libres pour ${value} pièces ?\n(Les cartes gardées pour l'échange ne sont pas vendues.)`)) return;
    let sold = 0;
    ATHLETES.forEach((a) => {
      while (Store.dupes(a.id) > 0) { Store.sellDupe(a.id, RARITIES[a.rarity].sell); sold++; }
    });
    Store.save();
    Quests.track("sell", sold);
    render();
    App.toast(`+${value} 🪙`);
  }

  function render() {
    renderFusion();
    renderDupes();
    const v = sellAllValue();
    sellAllBtn.textContent = v ? `Vendre tous les doublons (+${v} 🪙)` : "Aucun doublon à vendre";
    sellAllBtn.disabled = !v;
  }

  function init() {
    fusionEl = document.getElementById("fusion-list");
    dupesEl = document.getElementById("dupes-grid");
    sellAllBtn = document.getElementById("btn-sell-all");
    sellAllBtn.addEventListener("click", sellAll);
  }

  return { init, render };
})();

// Petits badges affichés sur une carte du classeur / de l'atelier
function slotBadges(a) {
  const d = Store.dupes(a.id);
  const r = Store.reserved(a.id);
  return (d > 0 ? `<span class="dup-badge">+${d}</span>` : "") +
         (r > 0 ? `<span class="trade-badge" title="Gardée pour l'échange">🔄 ${r}</span>` : "");
}
