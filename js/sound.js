// Sons du jeu, fabriqués à la volée avec la Web Audio API (aucun fichier audio)
const Sound = (() => {
  const KEY = "sportmasters_muted";
  let ctx = null, master = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch (e) {}

  // Le navigateur n'autorise le son qu'après un clic : on crée le contexte au premier besoin
  function ready() {
    if (muted) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  // Note simple avec enveloppe (attaque rapide, extinction douce)
  function tone(freq, start, dur, { type = "sine", vol = 0.2, to = null, attack = 0.01 } = {}) {
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Bruit filtré (papier, souffle, whoosh)
  function noise(start, dur, { vol = 0.3, filter = "bandpass", from = 1000, to = null, q = 1, crackle = false, attack = 0.02 } = {}) {
    const t = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    if (crackle) {
      // volume qui saute au hasard : effet de papier qui se déchire
      for (let x = 0; x < dur; x += 0.018) g.gain.setValueAtTime(vol * (0.25 + Math.random() * 0.75), t + x);
    } else {
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  const arpeggio = (notes, step, opts) => notes.forEach((n, i) => tone(n, i * step, opts.dur || 0.5, opts));

  return {
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) {}
      if (!muted) { ready(); tone(880, 0, 0.15, { vol: 0.12 }); }
      return muted;
    },

    // Le booster brille (grosse carte dedans)
    glow() {
      if (!ready()) return;
      arpeggio([1318, 1568, 1976, 2637], 0.07, { dur: 0.6, vol: 0.06 });
    },

    // Déchirement du booster
    tear() {
      if (!ready()) return;
      noise(0, 0.45, { vol: 0.5, from: 1200, to: 4500, q: 0.8, crackle: true });
      noise(0.05, 0.3, { vol: 0.15, filter: "highpass", from: 5000 });
    },

    // Carte retournée : juste un petit coup de vent (souffle qui monte puis retombe)
    flip() {
      if (!ready()) return;
      noise(0, 0.32, { vol: 0.2, filter: "bandpass", from: 350, to: 1800, q: 0.6, attack: 0.12 });
    },

    // Duels
    good() { if (ready()) arpeggio([784, 1175], 0.09, { dur: 0.35, vol: 0.12 }); },
    bad()  { if (ready()) { tone(220, 0, 0.35, { type: "square", vol: 0.06, to: 140 }); } },
    win()  { if (ready()) [523, 659, 784, 1047].forEach((n, i) => tone(n, i * 0.12, 0.9, { type: "triangle", vol: 0.13 })); },
    lose() { if (ready()) [392, 330, 262].forEach((n, i) => tone(n, i * 0.18, 0.6, { type: "triangle", vol: 0.1 })); },

    // Les étapes de l'animation Ultra rare / Légendaire / Brillante
    walkout(phase, big) {
      if (!ready()) return;
      if (phase === "beam") {
        noise(0, 1.1, { vol: 0.3, filter: "lowpass", from: 200, to: 4000, q: 2 });
        tone(110, 0, 1.1, { type: "sawtooth", vol: 0.05, to: 330, attack: 0.3 });
      }
      if (phase === "flag" || phase === "sport") {
        tone(phase === "flag" ? 95 : 120, 0, 0.6, { vol: 0.5, to: 40 });
        noise(0, 0.25, { vol: 0.25, filter: "lowpass", from: 600 });
      }
      if (phase === "card") {
        // fanfare : accord majeur montant + scintillement
        const chord = big ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047];
        chord.forEach((n, i) => tone(n, i * 0.07, 1.4, { type: "triangle", vol: 0.12, attack: 0.02 }));
        chord.forEach((n, i) => tone(n / 2, i * 0.07, 1.4, { type: "sawtooth", vol: 0.03, attack: 0.05 }));
        tone(55, 0, 0.8, { vol: 0.5, to: 35 });
        arpeggio(big ? [2093, 2637, 3136, 4186, 3136, 4186] : [2093, 2637, 3136], 0.09, { dur: 0.4, vol: 0.04 });
      }
    },
  };
})();
