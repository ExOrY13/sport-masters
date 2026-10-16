# Sport Masters — V1

Jeu de collection de cartes de sportifs : boosters, raretés, classeur.

## Lancer le jeu
Double-clique sur `index.html` (Chrome ou Edge conseillé). Une connexion internet est nécessaire pour les photos, drapeaux et polices.
La collection est sauvegardée dans le navigateur (localStorage).

## Organisation
| Fichier | Rôle |
|---|---|
| `js/data.js` | **Les cartes**, sports et raretés (taux de drop) — c'est ici que tu modifies le contenu |
| `js/photos-map.js` | Liens des photos Wikipédia (généré, ne pas modifier à la main) |
| `js/card.js` | Dessin d'une carte + effet 3D |
| `js/booster.js` | Ouverture des boosters + animation Ultra rare / Légendaire |
| `js/binder.js` | Classeur de collection |
| `js/atelier.js` | Fusion des doublons + vente groupée |
| `js/shop.js` | Boutique (boosters Premium, Élite, par sport) |
| `js/store.js` | Sauvegarde : cartes, pièces, étoiles, cartes gardées pour l'échange, boosters achetés |

## Les doublons
Sur chaque carte (clic dans le classeur ou l'atelier), le joueur choisit quoi faire d'un doublon :
- **Améliorer** : 1 doublon = 1 étoile (+1 ATT / +1 DEF), 5 étoiles max → cadre doré
- **Vendre** : contre des pièces (prix par rareté dans `RARITIES` de `js/data.js`)
- **Garder pour échange** : protégé de la vente et de la fusion (pour le futur Marché / Échanges)
- **Fusion** (Atelier) : 5 doublons d'une rareté → 1 carte de la rareté au-dessus

Prix et règles réglables dans `js/data.js` : `sell`, `MAX_STARS`, `FUSION_COST`, `PACK_TYPES`, `SPORT_PACK_PRICE`.
| `css/style.css` | Tout le style (une section par rareté : `.r-C`, `.r-PC`, … `.r-L`) |
| `tools/update-photos.ps1` | Récupère les photos des cartes |

## Ajouter des cartes
1. Ajoute des lignes à la fin de `RAW` dans `js/data.js` (le titre doit être exactement celui de l'article Wikipédia FR ; une précision entre parenthèses comme `"Michael Johnson (athlète)"` est retirée à l'affichage).
2. Lance : `powershell -ExecutionPolicy Bypass -File tools\update-photos.ps1`
   Le script signale les titres introuvables (`PAGE INTROUVABLE`) et les sportifs sans photo libre.

Chaque carte a un **identifiant fixe** tiré de son titre Wikipédia : ajouter des cartes ne casse pas les collections des joueurs.
⚠️ Si tu dois corriger le titre d'une carte déjà jouée, ajoute `"Nouveau titre": "Ancien titre"` dans `RENAMED` (`js/data.js`) pour qu'elle garde son identifiant.
Attention aux homonymes : vérifie que le titre mène bien au sportif (ex. `"Paolo Rossi (football)"` et pas `"Paolo Rossi"`).
Les numéros affichés (N°001…) sont recalculés automatiquement pour que chaque sport se suive.

## Boosters gratuits
1 booster toutes les 10 minutes, 10 en réserve maximum (`FREE_PACK_INTERVAL` et `FREE_PACK_MAX` dans `js/data.js`).

## Icônes, Brillantes, récompenses, quêtes
- **Icônes** : sportifs retraités, listés dans `ICONS` (`js/data.js`). Même rareté, design rétro + écharpe « ICÔNE ».
- **Brillantes** : 1 % de chance par carte (`SHINY_RATE`). Une fois obtenue, la carte s'affiche brillante dans la collection.
- **Collection complète** : récompense par sport (`SPORT_REWARD_PER_CARD` pièces par carte + 1 booster `SPORT_REWARD_BOOSTER`), à récupérer dans le classeur.
- **Quêtes du jour** : 3 quêtes tirées chaque jour dans `QUEST_POOL`, récompenses à récupérer au menu (`js/quests.js`).

## Duels (`js/duel.js`)
3 cartes contre 3 face à l'ordinateur. Une question par manche sur ton sportif (nationalité, description, sport, actif ou icône).
Bonne réponse = ta carte marque **ATT − ½ DEF adverse** + bonus de rapidité. Niveaux et récompenses : `DUEL_LEVELS` dans `js/data.js`.

## Vérifier les titres Wikipédia
`powershell -ExecutionPolicy Bypass -File tools\check-titles.ps1` signale les titres introuvables, les pages d'homonymie
et les pages qui ne semblent pas parler d'un sportif. À lancer après chaque ajout de cartes.

## Raccourcis de test
- **Shift + S** : le prochain booster contient une Brillante
- **Shift + L** : le prochain booster contient une Légendaire
- **Shift + U** : le prochain booster contient une Ultra rare
- **Shift + B** : remplit la réserve de boosters gratuits
