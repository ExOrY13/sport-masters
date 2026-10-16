// Fabrication visuelle d'une carte
function sportOf(a) { return SPORTS.find((s) => s.id === a.sport); }

// Nom du pays en français à partir du code drapeau ("fr" -> "France", "gb-eng" -> "Angleterre")
const UK_NATIONS = { "gb-eng": "Angleterre", "gb-sct": "Écosse", "gb-wls": "Pays de Galles", "gb-nir": "Irlande du Nord" };
let regionNames = null;
try { regionNames = new Intl.DisplayNames(["fr"], { type: "region" }); } catch (e) {}
function countryName(code) {
  if (UK_NATIONS[code]) return UK_NATIONS[code];
  try { return regionNames ? regionNames.of(code.toUpperCase()) : code.toUpperCase(); } catch (e) { return code.toUpperCase(); }
}

function initials(name) {
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function createCard(a, opts = {}) {
  const s = sportOf(a);
  const r = RARITIES[a.rarity];
  const st = Store.stars(a.id);
  const shiny = opts.shiny !== undefined ? opts.shiny : Store.hasShiny(a.id);
  const el = document.createElement("div");
  el.className = `card r-${a.rarity}` + (opts.faceDown ? " face-down" : "") + (st >= MAX_STARS ? " star-max" : "") +
    (a.icon ? " is-icon" : "") + (shiny ? " shiny" : "");
  el.style.setProperty("--sport", s.color);
  const starsHtml = st > 0 ? `<span class="c-stars">${"★".repeat(st)}${"☆".repeat(MAX_STARS - st)}</span>` : "";
  const bonus = st > 0 ? `<i>+${st}</i>` : "";

  const len = a.name.length;
  const nameSize = len > 20 ? "1.4em" : len > 15 ? "1.7em" : "2.1em";

  el.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-front">
        <div class="c-panel">
          <div class="c-top">
            <span class="c-rarity">${r.code}</span>
            <span class="c-num">N°${String(a.num).padStart(3, "0")}${shiny ? " ✨" : ""}</span>
            <img class="c-flag" src="https://flagcdn.com/w80/${a.country}.png" alt="" loading="lazy">
          </div>
          <div class="c-photo">
            <div class="c-photo-bg"></div>
            <div class="c-initials">${initials(a.name)}</div>
            <img class="c-img" alt="${a.name}">
            <span class="c-sport">${s.icon}</span>
            ${starsHtml}
            ${a.icon ? `<span class="c-icon-sash">ICÔNE</span>` : ""}
          </div>
          <div class="c-name" style="font-size:${nameSize}">${a.name}</div>
          <div class="c-desc">${a.desc}</div>
          <div class="c-stats">
            <div class="c-stat att"><b>${a.att + st}</b><small>ATT${bonus}</small></div>
            <div class="c-stat def"><b>${a.def + st}</b><small>DEF${bonus}</small></div>
          </div>
          <div class="c-foot">${a.discipline || s.name} · ${r.name}${a.icon ? " · Icône" : ""}${shiny ? " · Brillante" : ""}</div>
        </div>
        <div class="c-holo"></div>
        ${shiny ? `<div class="c-sparkles"><i></i><i></i><i></i><i></i><i></i><i></i></div>` : ""}
        <div class="c-shine"></div>
        <div class="c-glare"></div>
      </div>
      <div class="card-face card-back">
        <div class="back-inner">
          <div class="back-logo"><span>SPORT</span><b>MASTERS</b></div>
        </div>
      </div>
    </div>`;

  const img = el.querySelector(".c-img");
  img.addEventListener("load", () => el.classList.add("has-img"));
  Photos.get(a).then((src) => { if (src) img.src = src; });
  return el;
}

// Effet 3D + reflet qui suit la souris (style FUT)
function enableTilt(el, strength = 16) {
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", x * 100 + "%");
    el.style.setProperty("--my", y * 100 + "%");
    el.style.setProperty("--rx", (0.5 - y) * strength + "deg");
    el.style.setProperty("--ry", (x - 0.5) * strength + "deg");
    el.classList.add("tilting");
  });
  el.addEventListener("pointerleave", () => {
    ["--mx", "--my", "--rx", "--ry"].forEach((p) => el.style.removeProperty(p));
    el.classList.remove("tilting");
  });
}
