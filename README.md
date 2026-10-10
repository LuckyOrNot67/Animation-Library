# Animation Library

Bibliothèque locale de références visuelles, organisée par machine puis par personnage ou effet animé. Dépose des captures déjà réalisées : ce projet ne navigue pas sur les sites et ne scrape pas automatiquement.

## Démarrage

Node.js 20 ou plus récent.

```bash
npm ci
# Déposer les captures dans reception/Sugar Rush/, reception/Le Bandit/, etc.
npm run build
npm start
```

Ouvre http://127.0.0.1:4173 : la page principale explique le workflow. L’onglet Bibliothèque permet de filtrer les machines, rechercher un personnage/action, lire les animations Spine et examiner les pièces PNG et les fichiers sources.

```bash
npm run build -- --machine "Sugar Rush"  # reconstruire uniquement cette machine
npm test                               # tests de tri et reconstruction
npm run check                          # validation de syntaxe
```

## Organisation

```text
reception/                            # imports originaux, un dossier par machine
  Sugar Rush/                         # fichiers décompressés, sous-dossiers conservés
bibliotheque/                         # sortie générée
  sugar-rush/
    animations/hero-<hash>/
      skeleton.json                   # ou skeleton.skel / spritesheet.json
      atlas-<hash>.atlas
      textures.png                    # noms exacts attendus par l’atlas
      pieces/                         # morceaux PNG extraits, rotation/offsets restaurés
      actions/idle-<hash>/animation.json
      actions/exit-<hash>/animation.json
      metadata.json                   # os, slots, actions, fichiers, origines, avertissements
      README.md
    autres/                           # visuels reconnus non associés
    manifest.json                     # packages, fichiers écartés et erreurs
  catalogue.json                      # index de toute la bibliothèque
viewer/                               # mode d’emploi, galerie et lecteur
src/                                  # traitement hors ligne et serveur local
```

Un **package** représente un rig/personnage/effet. Ses actions (idle, enter, shoot…) partagent les os, skins, atlas et textures. Chaque action possède un dossier avec ses timelines ; toutes les sources nécessaires sont dans le package parent. Cela évite de dupliquer de grosses textures par action. Les pièces extraites couvrent toutes les actions et skins du rig, sans prétendre isoler les images visibles dans une action donnée.

## Tri et formats

Détection par contenu : Spine JSON/binaire, atlas, PNG/JPEG/WebP, spritesheets JSON et bundles JSON avec ressources embarquées. Les packs Pragmatic UHT numérotés et les textures KTX2/Basis sont pris en charge par les modules repris du projet original. La complétude dépend des fichiers réellement capturés. Les liens symboliques et fichiers cachés ne sont pas suivis. Décompresse les ZIP toi-même ; les HAR et pages HTML ne sont pas importés.

Les associations utilisent les régions du skeleton, les noms, les chemins et les dimensions des textures. Les associations ambiguës ou partielles sont signalées. Les textures sont conservées avec le nom attendu par l’atlas. Les images reconnues mais non associées restent dans autres/. Les fichiers inutiles sont exclus de la sortie et listés dans manifest.json ; **les imports originaux ne sont jamais supprimés**.

Une reconstruction remplace seulement la sortie de la machine concernée, après préparation dans un dossier temporaire. Ne modifie pas la sortie à la main : le prochain build écrasera ces modifications. Les machines absentes de reception/ restent dans la bibliothèque. Un verrou empêche deux builds simultanés ; après un arrêt brutal, vérifie qu’aucun build ne tourne puis supprime .build.lock si nécessaire.

## Lecture et limites

Le lecteur charge le runtime Spine depuis un CDN : Internet est nécessaire à l’aperçu, pas au tri. Les versions majeures/mineures du runtime et de l’export doivent correspondre ([documentation Spine](https://en.esotericsoftware.com/spine-player)). Les squelettes binaires sont conservés, mais leurs actions/timelines ne sont pas extraites : le lecteur les liste après chargement. Les exports anciens ou inconnus restent consultables comme fichiers sources. Les spritesheets sont découpées et jouées par séquence de frames dans un lecteur canvas à vitesse réglable (24 FPS par défaut si le fichier ne donne pas de cadence). Les atlas multiples sont réunis dans preview.atlas pour la lecture, tout en conservant les atlas individuels.

Les découpes identiques sont réutilisées par liens physiques entre packages ; évite de modifier leurs fichiers à la main.

Les pièces restaurent les offsets et rotations courants des atlas. Ce sont des éléments de texture, pas des captures de chaque frame animée. Les meshes se comprennent avec les vertices, poids, UV et timelines du skeleton.

## Pour une IA

Commence par [docs/POUR-IA.md](docs/POUR-IA.md), puis catalogue.json et metadata.json. Les exports fournissent les données d’animation, **pas le code source original du jeu ni le projet éditable .spine**. Les os, keyframes, courbes, contraintes et meshes permettent d’étudier la construction de l’animation.

## Préparer GitHub

Ce dossier constitue un projet autonome. Les imports bruts et fichiers locaux sont exclus de Git. La bibliothèque finale, ses métadonnées, ses actions et pièces sont incluses dans le dépôt préparé, pour qu’une IA puisse consulter directement les références. Avant publication, choisir le dépôt cible et sa visibilité (voir docs/GITHUB.md).

Les modules de détection, association, conversion Basis/UHT et le lecteur sont adaptés du projet Scrap local. La reconstruction et le viewer principal utilisent la nouvelle infrastructure.
