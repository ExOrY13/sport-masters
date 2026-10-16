// Récupère la photo de chaque sportif depuis Wikipédia (images sous licence libre)
// et la garde en cache pour ne pas la redemander à chaque fois.
const Photos = (() => {
  const KEY = "sportmasters_img_v1";
  const pending = {};
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {}
  }

  function pickSource(j) {
    if (!j) return null;
    const orig = j.originalimage;
    if (orig && orig.width <= 700) return orig.source;
    if (j.thumbnail) return j.thumbnail.source.replace(/\/\d+px-/, "/500px-");
    return orig ? orig.source : null;
  }

  function get(a) {
    if (a.img) return Promise.resolve(a.img);
    if (typeof PHOTO_MAP !== "undefined" && PHOTO_MAP[a.wiki]) return Promise.resolve(PHOTO_MAP[a.wiki]);
    if (a.wiki in cache) return Promise.resolve(cache[a.wiki]);
    if (pending[a.wiki]) return pending[a.wiki];

    const url = "https://fr.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(a.wiki.replace(/ /g, "_"));
    pending[a.wiki] = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const src = pickSource(j);
        cache[a.wiki] = src;
        persist();
        return src;
      })
      .catch(() => null) // hors ligne : on n'enregistre rien, on réessaiera plus tard
      .finally(() => { delete pending[a.wiki]; });
    return pending[a.wiki];
  }

  return { get };
})();
