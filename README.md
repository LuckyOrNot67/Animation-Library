# Animation Library — références Spine pour Claude Code

Bibliothèque de références pour créer des animations originales de slots/casino par code, sans l’éditeur graphique Spine. Le projet importe des exports depuis GitHub ou des captures HAR, analyse les rigs et les textures, indexe les actions pour Claude et propose un viewer. Ce n’est pas un modèle entraîné ni une garantie de qualité studio.

## Préparer le corpus pour Claude

Node.js 20 ou plus récent. Sur Mac/Linux :

```bash
git pull
npm ci
npm run prepare:claude
npm start
```

Sur Windows / PowerShell :

```powershell
git pull
npm.cmd ci
npm.cmd run prepare:claude
npm.cmd start
```

Ouvre http://127.0.0.1:4173. L’onglet **Sources GitHub / Claude** présente les dépôts ; la Bibliothèque réunit tes machines, les références importées et les exemples originaux.

`prepare:claude` importe la sélection initiale : tous les exports des exemples officiels et de rigc ; exemples Spine Animation AI ; 30 dossiers d’atlas Arknights et 10 Langrisser ; guides/licences des sources accessibles ; trois exemples originaux ; puis l’analyse. Les collections communautaires restent des références à droits non vérifiés et ne sont pas un kit commercial.

Les fichiers téléchargés restent dans `.local/references/`, exclus de Git : la commande les reconstruit depuis les commits figés et vérifie leurs empreintes. Le dépôt contient les outils, les liens, les analyses de tes références existantes et les exemples originaux. Donner le dépôt à Claude n’importe pas automatiquement toutes les sources et n’entraîne pas un modèle ; Claude doit lancer la préparation ou lire une sélection d’analyses.

Lire **[CLAUDE.md](CLAUDE.md)** puis **[docs/GUIDE-CLAUDE.md](docs/GUIDE-CLAUDE.md)**. Tous les dépôts sont liés dans **[sources/README.md](sources/README.md)** avec leur rôle et leurs restrictions.

## Explorer et enrichir

```bash
npm run sources:list
npm run sources:fetch                              # exemples officiels + rigc
npm run sources:fetch -- --guides-only              # guides figés de toutes les sources accessibles
npm run sources:fetch -- --source ID --bundles 100 --max-mb 512
npm run learn
npm run reference:search -- anticipation
npm run reference:search -- win
npm run create:demo
npm test
npm run check
```

`--bundles` limite le nombre de **dossiers contenant des atlas**, pas le nombre d’actions. `--bundles 0` importe tous les dossiers du périmètre de la source. Le budget `--max-mb` est par source ; un dépassement refuse l’import avant téléchargement. Un arbre GitHub tronqué ou un blob incorrect est refusé. Un pointeur Git LFS nécessite les vraies données.

**Pas de promesse de 500 000 animations** : les inventories mesurent les fichiers, les index les packages/actions analysés et les doublons exacts. Les SKEL binaires sont conservés mais leurs timelines ne sont pas décodées. Des milliers de variantes/forks ne valent pas des milliers de techniques différentes.

## Création sans éditeur

`npm run create:demo` dessine ses propres textures, construit atlas et JSON Spine 4.2, puis écrit trois rigs de casino : pièce, Wild et gemme. Chaque rig a idle, anticipation, spin, win et exit. Leur générateur **[src/create-demo.js](src/create-demo.js)** est modifiable par Claude ; il constitue une démonstration technique, pas un kit visuel de studio.

Les images téléchargées et le runtime ont leurs propres licences, même si tu ne passes pas par l’éditeur. La production doit utiliser des graphismes originaux ou autorisés. Les références et leurs restrictions restent identifiables par source/commit/empreinte.

## Déposer un HAR (workflow principal)

Dépose directement `gatorhunters2.har` dans `reception/`. Le nom sans `.har` devient celui de la machine. Lance `npm run build` : le code extrait les réponses contenues dans le HAR, reconnaît les ressources visuelles, associe les animations et écrit `bibliotheque/gatorhunters2/`. Aucun dossier intermédiaire à créer.

Un HAR placé dans `reception/Nom de machine/` fonctionne aussi et se combine aux fichiers déjà présents dans ce dossier. Si un dossier et un HAR à la racine ont exactement le même nom de machine, leurs ressources sont fusionnées. Les contenus identiques sont dédupliqués.

### Sur Windows / PowerShell

Dans le terminal ouvert à la racine du projet :

```powershell
git pull
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Pour traiter uniquement le HAR ajouté :

```powershell
npm.cmd run build -- --machine "gatorhunters2"
```

Puis ouvrir http://127.0.0.1:4173. Si le serveur est déjà lancé, arrête-le avec Ctrl+C avant de le relancer.

### Si le HAR manque de contenu

Exporte le journal Network **avec le contenu des réponses** (HAR with content), après rechargement du jeu et déclenchement des animations voulues. L’import ne télécharge pas les réponses manquantes sur Internet : leurs URLs peuvent expirer ou nécessiter la session du navigateur. Le terminal donne le nombre de réponses extraites et celles sans contenu ; `manifest.json` contient le rapport détaillé. Un HAR entièrement vide/inexploitable ou invalide provoque une erreur sans remplacer la sortie précédente. Une capture partielle produit des avertissements ; les ressources présentes restent consultables.

Le HAR original reste local dans `reception/`, exclu de Git. Seuls les corps de réponse sont analysés : cookies, en-têtes et corps de requête ne sont pas copiés. Les paramètres des URLs ne sont pas exportés dans les métadonnées.

## Organisation

```text
reception/                            # imports originaux
  gatorhunters2.har                    # nom du fichier = nom de la machine
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

Détection par contenu : Spine JSON/binaire, atlas, PNG/JPEG/WebP, spritesheets JSON et bundles JSON avec ressources embarquées. Les packs Pragmatic UHT numérotés et les textures KTX2/Basis sont pris en charge par les modules repris du projet original. La complétude dépend des fichiers réellement capturés. Les liens symboliques et fichiers cachés ne sont pas suivis. Les HAR sont importés directement : réponses texte et binaires base64, puis le même pipeline de détection et association. Décompresse les ZIP toi-même ; les pages HTML ne sont pas importées.

Les associations utilisent les régions du skeleton, les noms, les chemins et les dimensions des textures. Les associations ambiguës ou partielles sont signalées. Les textures sont conservées avec le nom attendu par l’atlas. Les images reconnues mais non associées restent dans autres/. Les fichiers inutiles sont exclus de la sortie et listés dans manifest.json ; **les imports originaux ne sont jamais supprimés**.

Une reconstruction remplace seulement la sortie de la machine concernée, après préparation dans un dossier temporaire. Ne modifie pas la sortie à la main : le prochain build écrasera ces modifications. Les machines absentes de reception/ restent dans la bibliothèque. Un verrou empêche deux builds simultanés ; après un arrêt brutal, vérifie qu’aucun build ne tourne puis supprime .build.lock si nécessaire.

## Lecture et limites

Le lecteur charge le runtime Spine depuis un CDN : Internet est nécessaire à l’aperçu, pas au tri. Les versions majeures/mineures du runtime et de l’export doivent correspondre ([documentation Spine](https://en.esotericsoftware.com/spine-player)). Les squelettes binaires sont conservés, mais leurs actions/timelines ne sont pas extraites : le lecteur les liste après chargement. Les exports anciens ou inconnus restent consultables comme fichiers sources. Les spritesheets sont découpées et jouées par séquence de frames dans un lecteur canvas à vitesse réglable (24 FPS par défaut si le fichier ne donne pas de cadence). Les atlas multiples sont réunis dans preview.atlas pour la lecture, tout en conservant les atlas individuels.

Les découpes identiques sont réutilisées par liens physiques entre packages ; évite de modifier leurs fichiers à la main.

Les pièces restaurent les offsets et rotations courants des atlas. Ce sont des éléments de texture, pas des captures de chaque frame animée. Les meshes se comprennent avec les vertices, poids, UV et timelines du skeleton.

## Pour une IA

Commence par CLAUDE.md et docs/GUIDE-CLAUDE.md. Pour lire les captures existantes : [docs/POUR-IA.md](docs/POUR-IA.md), puis catalogue.json et metadata.json. Les exports fournissent les données d’animation, **pas le code source original du jeu ni le projet éditable .spine**. Les os, keyframes, courbes, contraintes et meshes permettent d’étudier la construction de l’animation.

## Préparer GitHub

Ce dossier constitue un projet autonome. Les imports bruts et fichiers locaux sont exclus de Git. La bibliothèque finale, ses métadonnées, ses actions et pièces sont incluses dans le dépôt préparé, pour qu’une IA puisse consulter directement les références. Avant publication, choisir le dépôt cible et sa visibilité (voir docs/GITHUB.md).

Les modules de détection, association, conversion Basis/UHT et le lecteur sont adaptés du projet Scrap local. La reconstruction et le viewer principal utilisent la nouvelle infrastructure.
