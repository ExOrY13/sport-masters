// Mode Duel : 3 cartes contre 3, une question par manche.
// Bonne réponse = ta carte attaque : ATT - DEF adverse / 2 (+ bonus de rapidité). "L'attaque marque, la défense encaisse."
const Duel = (() => {
  let level = "normal";
  let team = [];          // ids choisis
  let game = null;        // partie en cours
  let timer = null;
  const $ = (id) => document.getElementById(id);

  const byId = (id) => ATHLETES.find((a) => a.id === id);
  const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const pickN = (arr, n) => shuffle(arr).slice(0, n);
  const att = (a, mine) => a.att + (mine ? Store.stars(a.id) : 0);
  const def = (a, mine) => a.def + (mine ? Store.stars(a.id) : 0);
  const power = (a) => a.att + a.def + 2 * Store.stars(a.id);
  const owned = () => ATHLETES.filter((a) => Store.count(a.id) > 0);

  // ---------- Questions générées à partir des données des cartes ----------
  function makeQuestion(a) {
    const r = Math.random();
    const sportLabel = (x) => x.discipline || sportOf(x).name;

    if (r < 0.4) {
      let pool = ATHLETES.filter((x) => x.sport === a.sport && x.id !== a.id);
      if (pool.length < 3) pool = ATHLETES.filter((x) => x.id !== a.id);
      const opts = shuffle([a, ...pickN(pool, 3)]);
      return { prompt: "Qui correspond à cette description ?", quote: a.desc,
               options: opts.map((x) => x.name), answer: opts.indexOf(a) };
    }
    if (r < 0.75) {
      const countries = [...new Set(ATHLETES.map((x) => x.country))].filter((c) => c !== a.country);
      const opts = shuffle([a.country, ...pickN(countries, 3)]);
      return { prompt: `Quelle est la nationalité de ${a.name} ?`, flags: opts,
               options: opts.map(countryName), answer: opts.indexOf(a.country) };
    }
    if (r < 0.9) {
      const opts = ["Oui, toujours en activité", "Non, c'est une Icône (retraité)"];
      return { prompt: `${a.name} est-il toujours en activité ?`, options: opts, answer: a.icon ? 1 : 0 };
    }
    const labels = [...new Set(ATHLETES.map(sportLabel))].filter((l) => l !== sportLabel(a));
    const opts = shuffle([sportLabel(a), ...pickN(labels, 3)]);
    return { prompt: `Dans quel sport ${a.name} s'est-il illustré ?`, options: opts, answer: opts.indexOf(sportLabel(a)) };
  }

  // ---------- Préparation ----------
  function autoTeam() {
    team = owned().sort((a, b) => power(b) - power(a)).slice(0, DUEL_TEAM_SIZE).map((a) => a.id);
    renderSetup();
  }

  function toggle(id) {
    if (team.includes(id)) team = team.filter((x) => x !== id);
    else if (team.length < DUEL_TEAM_SIZE) team.push(id);
    renderSetup();
  }

  function renderSetup() {
    $("duel-setup").hidden = false;
    $("duel-battle").hidden = true;
    $("duel-result").hidden = true;
    const d = Store.duels;
    $("duel-record").textContent = d.played ? `${d.won} victoire${d.won > 1 ? "s" : ""} sur ${d.played} duel${d.played > 1 ? "s" : ""}` : "Aucun duel joué pour l'instant";

    document.querySelectorAll(".level-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.level === level);
      b.querySelector("small").textContent = `Victoire : +${DUEL_LEVELS[b.dataset.level].reward} 🪙`;
    });

    team = team.filter((id) => Store.count(id) > 0);
    const slots = $("duel-team");
    slots.innerHTML = "";
    for (let i = 0; i < DUEL_TEAM_SIZE; i++) {
      const slot = document.createElement("div");
      slot.className = "duel-slot";
      const a = team[i] && byId(team[i]);
      if (a) {
        slot.appendChild(createCard(a));
        slot.title = "Retirer de l'équipe";
        slot.addEventListener("click", () => toggle(a.id));
      } else {
        slot.innerHTML = `<span>${i + 1}</span>`;
      }
      slots.appendChild(slot);
    }
    $("duel-start").disabled = team.length < DUEL_TEAM_SIZE;
    $("duel-team-count").textContent = `${team.length}/${DUEL_TEAM_SIZE}`;

    // Collection triée par puissance (les 60 premières qui correspondent à la recherche)
    const q = $("duel-filter").value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const list = owned()
      .filter((a) => !q || a.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q))
      .sort((a, b) => power(b) - power(a));
    const grid = $("duel-pick");
    grid.innerHTML = "";
    if (owned().length < DUEL_TEAM_SIZE) {
      grid.innerHTML = `<p class="empty-note">Il te faut au moins ${DUEL_TEAM_SIZE} cartes pour jouer. Ouvre des boosters !</p>`;
      return;
    }
    list.slice(0, 60).forEach((a) => {
      const slot = document.createElement("div");
      slot.className = "slot owned" + (team.includes(a.id) ? " picked" : "");
      slot.appendChild(createCard(a));
      slot.addEventListener("click", () => toggle(a.id));
      grid.appendChild(slot);
    });
    if (list.length > 60) grid.insertAdjacentHTML("beforeend", `<p class="empty-note">… et ${list.length - 60} autres : utilise la recherche</p>`);
  }

  // L'adversaire : 3 cartes d'une force proche de ton équipe (+/- selon le niveau)
  function buildRival() {
    const mine = team.map(byId);
    const target = mine.reduce((s, a) => s + power(a), 0) / mine.length + DUEL_LEVELS[level].power;
    const pool = ATHLETES.filter((a) => !team.includes(a.id) && a.rarity !== "S")
      .map((a) => [Math.abs(a.att + a.def - target) + Math.random() * 14, a])
      .sort((x, y) => x[0] - y[0]);
    return pool.slice(0, DUEL_TEAM_SIZE).map((x) => x[1]);
  }

  // ---------- Partie ----------
  function start() {
    if (team.length < DUEL_TEAM_SIZE) return;
    game = {
      mine: shuffle(team.map(byId)),
      rival: buildRival(),
      rivalName: DUEL_RIVALS[Math.floor(Math.random() * DUEL_RIVALS.length)],
      round: 0, me: 0, him: 0,
    };
    $("duel-setup").hidden = true;
    $("duel-result").hidden = true;
    $("duel-battle").hidden = false;
    $("duel-rival-name").textContent = game.rivalName;
    window.scrollTo(0, 0);
    playRound();
  }

  function cardBox(id, a, label) {
    const box = $(id);
    box.innerHTML = "";
    const card = createCard(a, { faceDown: true, shiny: false });
    box.appendChild(card);
    box.insertAdjacentHTML("beforeend", `<div class="duel-name">${label}</div>`);
    return card;
  }

  function playRound() {
    const i = game.round;
    const a = game.mine[i], b = game.rival[i];
    game.q = makeQuestion(a);
    game.answered = false;
    game.cards = [cardBox("duel-mine", a, a.name), cardBox("duel-rival", b, "???")];
    $("duel-round").textContent = `Manche ${i + 1} / ${DUEL_TEAM_SIZE}`;
    $("duel-score-me").textContent = game.me;
    $("duel-score-him").textContent = game.him;
    $("duel-outcome").innerHTML = "";
    $("duel-next").hidden = true;

    $("duel-prompt").textContent = game.q.prompt;
    $("duel-quote").textContent = game.q.quote ? `« ${game.q.quote} »` : "";
    $("duel-quote").hidden = !game.q.quote;
    const opts = $("duel-options");
    opts.innerHTML = "";
    game.q.options.forEach((label, k) => {
      const btn = document.createElement("button");
      btn.className = "duel-opt";
      btn.innerHTML = (game.q.flags ? `<img src="https://flagcdn.com/w40/${game.q.flags[k]}.png" alt="">` : "") + label;
      btn.addEventListener("click", () => answer(k));
      opts.appendChild(btn);
    });

    // compte à rebours
    game.deadline = Date.now() + DUEL_TIME * 1000;
    clearInterval(timer);
    timer = setInterval(() => {
      const left = Math.max(0, game.deadline - Date.now());
      $("duel-timer").style.width = (left / (DUEL_TIME * 1000)) * 100 + "%";
      if (!left) answer(-1);
    }, 100);
  }

  function answer(k) {
    if (game.answered) return;
    game.answered = true;
    clearInterval(timer);
    const i = game.round;
    const a = game.mine[i], b = game.rival[i];
    const left = Math.max(0, game.deadline - Date.now()) / 1000;

    const ok = k === game.q.answer;
    const aiOk = Math.random() < DUEL_LEVELS[level].ai;
    const myBase = Math.max(5, att(a, true) - Math.round(def(b) / 2));
    const hisBase = Math.max(5, att(b) - Math.round(def(a, true) / 2));
    const myBonus = ok ? Math.ceil(left) : 0;
    const hisBonus = aiOk ? Math.floor(Math.random() * 9) : 0;
    const myPts = ok ? myBase + myBonus : 0;
    const hisPts = aiOk ? hisBase + hisBonus : 0;
    game.me += myPts;
    game.him += hisPts;

    // corrige les boutons, puis on retourne les cartes
    [...$("duel-options").children].forEach((btn, n) => {
      btn.disabled = true;
      if (n === game.q.answer) btn.classList.add("right");
      else if (n === k) btn.classList.add("wrong");
    });
    if (ok) Sound.good(); else Sound.bad();
    setTimeout(() => {
      game.cards.forEach((c) => c.classList.remove("face-down"));
      Sound.flip();
      $("duel-rival").querySelector(".duel-name").textContent = b.name;
    }, 350);

    const line = (who, card, other, base, bonus, pts, good) => good
      ? `<p class="hit">✅ ${who} : <b>${card.name}</b> attaque → ${att(card, who === "Toi")} ATT − ${Math.round(def(other, who !== "Toi") / 2)} (½ DEF) ${bonus ? `+ ${bonus} rapidité ` : ""}= <b>${pts} pts</b></p>`
      : `<p class="miss">❌ ${who} : ${k === -1 && who === "Toi" ? "temps écoulé" : "mauvaise réponse"}, 0 pt</p>`;
    $("duel-outcome").innerHTML =
      line("Toi", a, b, myBase, myBonus, myPts, ok) + line(game.rivalName, b, a, hisBase, hisBonus, hisPts, aiOk);
    $("duel-score-me").textContent = game.me;
    $("duel-score-him").textContent = game.him;

    const last = i === DUEL_TEAM_SIZE - 1;
    $("duel-next").textContent = last ? "Voir le résultat" : "Manche suivante";
    $("duel-next").hidden = false;
  }

  function next() {
    if (game.round < DUEL_TEAM_SIZE - 1) { game.round++; playRound(); return; }
    finish();
  }

  function finish() {
    const won = game.me > game.him, draw = game.me === game.him;
    const reward = won ? DUEL_LEVELS[level].reward : draw ? 10 : 0;
    Store.recordDuel(won);
    if (reward) Store.addCoins(reward);
    Store.save();
    if (won) Quests.track("duelwin"); else App.refreshProgress();
    if (won) Sound.win(); else if (!draw) Sound.lose();

    $("duel-battle").hidden = true;
    $("duel-result").hidden = false;
    $("duel-result-title").textContent = won ? "🏆 Victoire !" : draw ? "🤝 Égalité" : "Défaite…";
    $("duel-result-title").className = won ? "win" : draw ? "draw" : "lose";
    $("duel-result-score").textContent = `${game.me} – ${game.him} contre ${game.rivalName} (${DUEL_LEVELS[level].name})`;
    $("duel-result-reward").textContent = reward ? `+${reward} 🪙` : "Pas de récompense cette fois. Retente ta chance !";
  }

  function render() {
    if (game && !$("duel-battle").hidden) return; // ne pas casser une partie en cours
    renderSetup();
  }

  function init() {
    document.querySelectorAll(".level-btn").forEach((b) =>
      b.addEventListener("click", () => { level = b.dataset.level; renderSetup(); }));
    $("duel-auto").addEventListener("click", autoTeam);
    $("duel-start").addEventListener("click", start);
    $("duel-next").addEventListener("click", next);
    $("duel-again").addEventListener("click", start);
    $("duel-change").addEventListener("click", () => { game = null; renderSetup(); });
    $("duel-quit").addEventListener("click", () => {
      if (confirm("Abandonner ce duel ? (il comptera comme une défaite)")) {
        clearInterval(timer);
        Store.recordDuel(false); Store.save();
        game = null; renderSetup();
      }
    });
    let t;
    $("duel-filter").addEventListener("input", () => { clearTimeout(t); t = setTimeout(renderSetup, 150); });
  }

  return { init, render };
})();
