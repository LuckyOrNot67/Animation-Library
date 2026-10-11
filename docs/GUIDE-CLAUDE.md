# Créer des animations de slots/casino avec des fichiers Spine

Ce guide est une synthèse originale, pas une copie intégrale des documentations tierces. Les guides sources sont référencés dans sources/catalogue.json ; les versions téléchargées restent dans .local/references/guides/. Les exports et outils Spine peuvent être utilisés par code, mais l’intégration du runtime demeure soumise à sa licence.

## Ce qu’une IA doit apprendre du corpus

Un rig est la combinaison d’une hiérarchie d’os, de slots ordonnés, d’attachments répartis par skin, de régions d’atlas et de timelines. L’animation est portée par les données, pas par un programme de gameplay nécessairement présent dans le HAR.

- Texture page : planche d’images. Ses régions ont bounds/xy/size, rotation, offsets, dimensions originales et parfois des indices de séquence.
- Attachment : une région ou un mesh, avec transform et dimensions. Les linkedmeshes héritent d’un autre mesh ; ne pas supposer un nouveau PNG.
- Slot : lie attachment et bone, définit ordre de dessin, teinte et blending.
- Bone : transform local relatif au parent. Un pivot de coude épaule ou charnière n’est pas forcément le centre de l’image.
- Mesh : positions, UV, triangles et éventuellement poids multi-os. Les UV pointent dans la région d’atlas, les vertices définissent la géométrie.
- Timeline : rotations, translations, scale, shear, couleur, attachment swaps, deformations, contraintes, draw order et events.

Voir [Spine JSON](https://esotericsoftware.com/spine-json-format), [atlas](https://esotericsoftware.com/spine-atlas-format), [architecture runtime](https://esotericsoftware.com/spine-runtime-architecture) et [Spine Player](https://esotericsoftware.com/spine-player). Une version 4.2 doit être examinée avec un runtime compatible 4.2 ; le schéma n’est pas identique à 3.8 ou 4.3.

## Lire une référence sans se perdre

Chercher une intention (`win`, `anticipation`, `idle`, `transition`, `spin`) dans learning/actions.jsonl. Les tags reposent sur les noms et sont heuristiques. Comparer quelques rigs, ne pas prendre 5 forks du même export pour 5 nouvelles techniques.

Chaque case fournit : complexité du rig, durée et nombre de clés par action, chemins des canaux, os/slots animés, attachments associés à leurs régions, meshes et contraintes, provenance et warnings. L’index marque les skeletons exactement identiques par empreinte ; il ne prétend pas reconnaître toutes les animations équivalentes après conversion de version.

Ouvrir la texture originale et pieces/ ; lire ensuite les coordonnées d’attachment et la hiérarchie. Les découpes réunissent toutes les régions de l’atlas, potentiellement d’autres personnages. Leur présence ne prouve pas que la pièce apparaît dans une action : la visibilité exacte exige l’évaluation du runtime avec la skin et la pose.

Les SKEL binaires ne sont pas décodés par notre analyseur. Ils servent à observer le rendu quand leur version est compatible. Pour lire leurs timelines, convertir avec un outil adapté à la version, vérifier la conversion et garder le binaire original. [Spine Thing](https://github.com/cambacodes/spine-thing) documente ses conversions ; ne pas mélanger cela avec un export original certifié.

## Concevoir des assets originaux

Avant de coder, définir un brief : personnage/effet, dimensions à l’écran, style, actions voulues, appareils cibles et limites de coût. Un personnage ne devient pas visuellement haut de gamme parce qu’on lui ajoute beaucoup de keyframes.

Séparer en PNG transparents les parties réellement articulées : tête, torse, haut/bas des bras, mains, jambes, accessoires, mèches ou étoffe si nécessaire. Prévoir les recouvrements aux articulations pour masquer les trous. Dessiner des vues alternatives quand une rotation 2D ne suffit pas : une rotation du bone ne recrée pas le dos de la main.

Choisir les pivots et leur relation parent avant les timelines. Utiliser des meshes pour déformer une silhouette ; démarrer avec des régions rigides pour éviter de complexifier tout le personnage sans besoin.

## Actions de casino à construire

| Action           | Décomposition suggérée                                   | Contrôle de rendu                                          |
| ---------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| idle             | respiration discrète, regard, petit mouvement secondaire | pas de dérive ; boucle sans saut                           |
| anticipation     | compression/recul, accent principal, relâchement         | silhouette lisible avant le gain                           |
| symbol win       | montée rapide, overshoot, retour amorti, halo court      | symbole reconnaissable, pas de flash permanent             |
| big win          | événement principal, éclats décalés, retombée, repos     | hiérarchie visuelle, éviter de tout animer au même instant |
| bonus enter/exit | translation/scale/opacity et accessoires en retard       | passage cohérent vers l’état suivant                       |
| reel stop        | arrêt, rebond bref, établissement de la pose             | durée contrôlée, placement final exact                     |
| coin rain        | émission échelonnée, arc, rotation, disparition          | limiter objets actifs, recycler, mesurer le rendu          |

Ces recettes sont des décisions de mise en scène originales, pas des durées universelles. Ajuster l’amplitude et le timing au visuel, pas au nom du fichier de référence.

## Écrire sans l’éditeur Spine

Utiliser src/create-demo.js comme premier exemple reproductible. Il dessine ses textures en SVG puis PNG, construit un atlas et un rig JSON 4.2, écrit ses timelines et génère la bibliothèque. Les images sont originales et simples, faites pour montrer le pipeline ; elles ne prétendent pas égaler une direction artistique de studio.

1. Partir des PNG originaux et d’un rig stable ; garder positions de repos/pivots explicites.
2. Choisir un schéma Spine précis. Respecter les noms de champs de cette version (par exemple, valeurs de timeline et encoding des courbes).
3. Créer les actions séparées : durée, keys, transitions, events documentés. Une action doit partager les textures du rig, sans dupliquer les planches.
4. Prévoir un atlas multi-page si nécessaire, avec padding et cohérence de la transparence PMA. Garder texture filename et atlas page name identiques.
5. Valider les références bone/slot/attachment et les images ; puis charger réellement dans le viewer. Un JSON valide syntaxiquement ne prouve pas qu’un runtime l’accepte.
6. Comparer des poses au début, à l’accent et à la fin. Tester boucle, pause/reprise, skins et changement d’action.
7. Exporter skeleton.json, atlas, textures, pièces/manifest, générateur et README du résultat.

Outils à étudier : [rigc](https://github.com/rig-c/core) compile des specs déclaratives en données Spine 4.3 ; [Rev2D](https://github.com/RevStudio/Rev2D) a son propre rig JSON et des exports Spine. Leurs imports/exports ont des limites documentées ; aucune compatibilité n’est supposée sans test. [Spine Animation AI](https://github.com/GenielabsOpenSource/spine-animation-ai) est sous licence non commerciale et ne sert pas de dépendance automatique à notre production.

## Performance et qualité mesurées

Compter os, slots, meshes/UV, contraintes, texture pages, texture memory (approximation RGBA non compressée = width × height × 4), nombre d’objets simultanés et keyframes. Ces métriques aident à comparer des rigs mais ne mesurent pas à elles seules le GPU ou les draw calls.

Réduire l’overdraw des grands halos transparents, grouper les textures cohérentes, éviter changements de blend superflus, ne pas sur-échantillonner les courbes, recycler effets répétitifs et tester plusieurs machines affichées à la fois. Pour les pluie de pièces/particules très nombreuses, un moteur de particules peut mieux convenir qu’un gros rig Spine unique.

Définir des budgets au niveau du jeu, puis mesurer FPS/temps de frame, temps de chargement et mémoire sur les téléphones ciblés. Un rendu local desktop à 60 FPS ne constitue pas une validation mobile. Vérifier également le contenu artistique : déformations propres, pas de découpes visibles, pose claire, offsets corrects, séquences sans pop et transitions qui gardent leur intention.

## Brief à donner à Claude

> Lis CLAUDE.md et ce guide. Cherche trois références JSON pour anticipation, win et idle. Explique leurs rigs/attachments/timelines sans copier leurs graphismes. Avec mes images originales, écris un générateur reproductible d’un rig Spine 4.2 pour un symbole de casino : idle, anticipation, win et exit. Donne les paramètres ajustables de timing/amplitude, atlas et textures. Valide les fichiers et le rendu, documente les limites et propose les mesures de performance sur appareil cible. Ne prétends pas avoir entraîné un modèle sur le corpus.
