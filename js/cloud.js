// Comptes en ligne (Supabase) : pseudo + mot de passe, la partie est sauvegardée en ligne
// et se retrouve sur n'importe quel appareil.
//  - Au premier compte créé, la partie du navigateur est envoyée en ligne.
//  - Ensuite, la partie en ligne fait foi : elle remplace celle du navigateur à la connexion.
//  - Chaque sauvegarde est envoyée 1,5 s après la dernière action.
const Cloud = (() => {
  // Supabase demande un e-mail : on en fabrique un à partir du pseudo (aucun mail n'est envoyé,
  // la confirmation par e-mail doit être désactivée dans Supabase).
  const DOMAIN = "joueurs.sport-masters.app";
  const DIRTY_KEY = "sportmasters_cloud_dirty"; // des changements pas encore envoyés
  let client = null, user = null, pseudo = "", timer = null, lastSync = 0, applying = false, status = "";
  let modal, formWrap, accountBox, form, pseudoEl, passEl, errEl, noteEl, submitBtn, nameEl, statusEl, mode = "login";

  const toEmail = (p) => p.trim().toLowerCase() + "@" + DOMAIN;
  const isDirty = () => { try { return localStorage.getItem(DIRTY_KEY) === "1"; } catch (e) { return false; } };
  const setDirty = (v) => { try { v ? localStorage.setItem(DIRTY_KEY, "1") : localStorage.removeItem(DIRTY_KEY); } catch (e) {} };

  // ---------- Synchronisation ----------
  async function pull() {
    const { data, error } = await client.from("saves").select("data, updated_at").eq("id", user.id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function push() {
    if (!user) return;
    clearTimeout(timer);
    const now = new Date().toISOString();
    const { error } = await client.from("saves").upsert({ id: user.id, pseudo, data: Store.exportState(), updated_at: now });
    if (error) { setStatus("error"); return; }
    setDirty(false);
    lastSync = Date.parse(now);
    setStatus("ok");
  }

  function queue() {
    if (!user || applying) return;
    setDirty(true);
    setStatus("pending");
    clearTimeout(timer);
    timer = setTimeout(push, 1500);
  }

  function apply(data) {
    applying = true;
    Store.replace(data);
    applying = false;
    App.reloadAll();
  }

  // Après la connexion (ou au chargement si une session existe déjà)
  async function attach(u) {
    user = u;
    pseudo = (u.user_metadata && u.user_metadata.pseudo) || u.email.split("@")[0];
    paintButtons();
    try {
      const row = await pull();
      if (row && row.data && row.data.owned && !isDirty()) {
        apply(row.data);
        lastSync = Date.parse(row.updated_at);
        setStatus("ok");
      } else {
        await push(); // premier passage, ou changements faits hors ligne : on envoie la partie du navigateur
      }
    } catch (e) { setStatus("error"); }
  }

  // Quand on revient sur l'onglet : on récupère la partie si elle a avancé sur un autre appareil
  async function refreshFromCloud() {
    if (!user || isDirty()) return;
    try {
      const row = await pull();
      if (row && Date.parse(row.updated_at) > lastSync) {
        apply(row.data);
        lastSync = Date.parse(row.updated_at);
      }
    } catch (e) {}
  }

  // ---------- Interface ----------
  function setStatus(s) {
    status = s;
    paintButtons();
    if (statusEl) statusEl.textContent = { ok: "✅ Partie sauvegardée en ligne", pending: "⏳ Sauvegarde en cours…",
      error: "⚠️ Sauvegarde impossible pour l'instant (connexion internet ?). On réessaie à la prochaine action." }[s] || "";
  }

  function paintButtons() {
    const mark = status === "error" ? " ⚠️" : status === "pending" ? " ⏳" : "";
    document.querySelectorAll("[data-auth]").forEach((b) => {
      b.classList.toggle("soon", !client);
      b.classList.toggle("logged", !!user);
      const label = b.querySelector(".auth-label") || b;
      if (b.classList.contains("tile")) {
        b.querySelector(".tile-title").textContent = user ? `Connecté : ${pseudo}` : "Se connecter / Créer un compte";
        b.querySelector(".tile-sub").textContent = user ? "Ta partie est sauvegardée en ligne" + mark : "Joue sur n'importe quel appareil avec ta partie";
      } else {
        label.textContent = user ? pseudo + mark : "Se connecter";
      }
    });
  }

  function setMode(m) {
    mode = m;
    modal.querySelectorAll(".auth-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    submitBtn.textContent = m === "login" ? "Se connecter" : "Créer mon compte";
    passEl.autocomplete = m === "login" ? "current-password" : "new-password";
    noteEl.innerHTML = m === "login"
      ? "La partie de ce navigateur sera remplacée par celle de ton compte."
      : "Ta partie actuelle sera gardée sur ton nouveau compte.<br><b>Retiens bien ton mot de passe</b> : il ne peut pas être récupéré.";
    errEl.textContent = "";
  }

  function open() {
    if (!client) { App.toast("La connexion arrive bientôt !"); return; }
    formWrap.hidden = !!user;
    accountBox.hidden = !user;
    if (user) { nameEl.textContent = pseudo; setStatus(status); }
    else { setMode(mode); pseudoEl.value = ""; passEl.value = ""; }
    modal.hidden = false;
    if (!user) setTimeout(() => pseudoEl.focus(), 50);
  }
  const close = () => { modal.hidden = true; };

  const ERRORS = {
    "Invalid login credentials": "Pseudo ou mot de passe incorrect.",
    "User already registered": "Ce pseudo est déjà pris.",
  };

  async function submit(e) {
    e.preventDefault();
    const p = pseudoEl.value.trim(), pass = passEl.value;
    if (!/^[A-Za-z0-9_-]{3,16}$/.test(p)) { errEl.textContent = "Pseudo : 3 à 16 caractères (lettres, chiffres, - et _)."; return; }
    if (pass.length < 6) { errEl.textContent = "Mot de passe : 6 caractères minimum."; return; }
    errEl.textContent = "";
    submitBtn.disabled = true;
    try {
      const res = mode === "login"
        ? await client.auth.signInWithPassword({ email: toEmail(p), password: pass })
        : await client.auth.signUp({ email: toEmail(p), password: pass, options: { data: { pseudo: p } } });
      if (res.error) { errEl.textContent = ERRORS[res.error.message] || res.error.message; return; }
      if (!res.data.session) { errEl.textContent = "Compte créé mais pas de session : désactive « Confirm email » dans Supabase."; return; }
      if (mode === "signup") setDirty(true); // on garde la partie du navigateur pour le nouveau compte
      await attach(res.data.user);
      close();
      App.toast(mode === "login" ? `Bon retour ${pseudo} !` : `Bienvenue ${pseudo} ! Ta partie est sauvegardée en ligne.`);
    } catch (err) {
      errEl.textContent = "Connexion impossible. Vérifie ta connexion internet.";
    } finally {
      submitBtn.disabled = false;
    }
  }

  async function logout() {
    if (isDirty()) await push();
    await client.auth.signOut();
    user = null; pseudo = ""; status = "";
    setDirty(false);
    apply({}); // le navigateur repart d'une partie vide, la partie reste sur le compte
    paintButtons();
    close();
    App.toast("Déconnecté. Ta partie t'attend sur ton compte.");
  }

  async function init() {
    modal = document.getElementById("auth-modal");
    formWrap = document.getElementById("auth-form-wrap");
    accountBox = document.getElementById("auth-account");
    form = document.getElementById("auth-form");
    pseudoEl = document.getElementById("auth-pseudo");
    passEl = document.getElementById("auth-pass");
    errEl = document.getElementById("auth-error");
    noteEl = document.getElementById("auth-note");
    submitBtn = document.getElementById("auth-submit");
    nameEl = document.getElementById("auth-name");
    statusEl = document.getElementById("auth-status");

    document.querySelectorAll("[data-auth]").forEach((b) => b.addEventListener("click", open));
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    document.getElementById("auth-close").addEventListener("click", close);
    modal.querySelectorAll(".auth-tabs button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
    form.addEventListener("submit", submit);
    document.getElementById("auth-logout").addEventListener("click", logout);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    if (SUPABASE_URL && SUPABASE_KEY && window.supabase) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      Store.onSave = queue;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden" && isDirty()) push();
        if (document.visibilityState === "visible") refreshFromCloud();
      });
    }
    paintButtons();
    if (!client) return;
    const { data } = await client.auth.getSession();
    if (data.session) attach(data.session.user);
  }

  return { init, get loggedIn() { return !!user; } };
})();
