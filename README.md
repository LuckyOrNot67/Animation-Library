# Animation Library

Bibliothèque locale de références visuelles, organisée par machine puis par personnage ou effet animé. Dépose des captures déjà réalisées : ce projet ne navigue pas sur les sites et ne scrape pas automatiquement.

## Démarrage

Node.js 20 ou plus récent.

```bash
npm ci
# Déposer reception/gatorhunters2.har (ou des fichiers dans reception/Sugar Rush/)
npm run build
npm start
```

Ouvre http://127.0.0.1:4173 : la page principale explique le workflow. L’onglet Bibliothèque permet de filtrer les machines, rechercher un personnage/action, lire les animations Spine et examiner les pièces PNG et les fichiers sources.

```bash
npm run build -- --machine "Sugar Rush"  # reconstruire uniquement cette machine
npm test                               # tests de tri et reconstruction
npm run check                          # validation de syntaxe
```

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

Commence par [docs/POUR-IA.md](docs/POUR-IA.md), puis catalogue.json et metadata.json. Les exports fournissent les données d’animation, **pas le code source original du jeu ni le projet éditable .spine**. Les os, keyframes, courbes, contraintes et meshes permettent d’étudier la construction de l’animation.

## Préparer GitHub

Ce dossier constitue un projet autonome. Les imports bruts et fichiers locaux sont exclus de Git. La bibliothèque finale, ses métadonnées, ses actions et pièces sont incluses dans le dépôt préparé, pour qu’une IA puisse consulter directement les références. Avant publication, choisir le dépôt cible et sa visibilité (voir docs/GITHUB.md).

Les modules de détection, association, conversion Basis/UHT et le lecteur sont adaptés du projet Scrap local. La reconstruction et le viewer principal utilisent la nouvelle infrastructure.
