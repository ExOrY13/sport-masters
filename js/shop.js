// Boutique : on dépense les pièces gagnées avec les doublons pour acheter des boosters spéciaux
const Shop = (() => {
  let gridEl, sportsEl;

  function offer(key, extraClass = "") {
    const info = packInfo(key);
    const s = info.sport && SPORTS.find((x) => x.id === info.sport);
    const el = document.createElement("div");
    el.className = "offer " + extraClass;
    if (s) el.style.setProperty("--sport", s.color);
    const owned = Store.packCount(key);
    el.innerHTML = `
      <div class="offer-pack">${s ? s.icon : key === "elite" ? "👑" : "💎"}</div>
      <div class="offer-name">${info.name}</div>
      <div class="offer-desc">${info.desc}</div>
      ${owned ? `<div class="offer-owned">Tu en as ${owned}</div>` : ""}
      <button class="btn btn-yellow offer-buy">${info.price} 🪙</button>`;
    const btn = el.querySelector(".offer-buy");
    btn.disabled = Store.coins < info.price;
    btn.addEventListener("click", () => buy(key));
    return el;
  }

  function buy(key) {
    const info = packInfo(key);
    if (!Store.spend(info.price)) return;
    Store.giveBooster(key);
    Store.save();
    App.refreshProgress();
    render();
    App.toast(`${info.name} ajouté ! Ouvre-le dans l'onglet Boosters`);
  }

  function render() {
    gridEl.innerHTML = "";
    gridEl.append(offer("premium", "offer-premium"), offer("elite", "offer-elite"));
    sportsEl.innerHTML = "";
    SPORTS.forEach((s) => sportsEl.appendChild(offer("sport:" + s.id, "offer-sport")));
  }

  function init() {
    gridEl = document.getElementById("shop-main");
    sportsEl = document.getElementById("shop-sports");
  }

  return { init, render };
})();
