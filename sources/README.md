# Dépôts GitHub vérifiés

Inventaire du 11 octobre 2026. Les nombres d’atlas/skel sont des fichiers, pas un nombre d’animations uniques. Les branches sont figées par commit pour reproduire les imports.

| Source                                                                                                | Rôle         | Atlas | SKEL | Usage / droits         |
| ----------------------------------------------------------------------------------------------------- | ------------ | ----: | ---: | ---------------------- |
| [Diew/Nikke-db.github.io](https://github.com/Diew/Nikke-db.github.io)                                 | game-archive |  1785 | 1785 | unverified-assets      |
| [EsotericSoftware/spine-runtimes](https://github.com/EsotericSoftware/spine-runtimes)                 | examples     |   235 |  138 | evaluation-only        |
| [EsotericSoftware/spine-superspineboy](https://github.com/EsotericSoftware/spine-superspineboy)       | examples     |     3 |    0 | evaluation-only        |
| [GenielabsOpenSource/spine-animation-ai](https://github.com/GenielabsOpenSource/spine-animation-ai)   | authoring    |     2 |    0 | noncommercial          |
| [Nikke-db/Nikke-db.github.io](https://github.com/Nikke-db/Nikke-db.github.io)                         | game-archive |  1533 | 1533 | unverified-assets      |
| [OldBernhardt/langrisser-spiner-db](https://github.com/OldBernhardt/langrisser-spiner-db)             | game-archive |  1282 | 2062 | unverified-assets      |
| [PuppiizSunniiz/Arknights-Spines](https://github.com/PuppiizSunniiz/Arknights-Spines)                 | game-archive |  3974 | 3959 | unverified-assets      |
| [RevStudio/Rev2D](https://github.com/RevStudio/Rev2D)                                                 | authoring    |     2 |    0 | mit-code-assets-review |
| [SunsetMkt/blue-archive-spine-production](https://github.com/SunsetMkt/blue-archive-spine-production) | game-archive |     0 |    0 | unverified-assets      |
| [Zormolo/Brown-Dust-2-Assets](https://github.com/Zormolo/Brown-Dust-2-Assets)                         | game-archive |     0 |    0 | unverified-assets      |
| [bungaku-moe/DaiblosCoreAssets](https://github.com/bungaku-moe/DaiblosCoreAssets)                     | game-archive |   420 |    0 | unverified-assets      |
| [cambacodes/spine-catalog](https://github.com/cambacodes/spine-catalog)                               | catalog      |     0 |    0 | unverified-assets      |
| [cambacodes/spine-thing](https://github.com/cambacodes/spine-thing)                                   | viewer       |     0 |    0 | mit-code-assets-review |
| [firejune/rigc](https://github.com/rig-c/core)                                                        | authoring    |    28 |    0 | mixed-mit-third-party  |
| [firejune/spine-html](https://github.com/rig-c/play)                                                  | runtime      |     1 |    0 | mit-code-assets-review |
| [isHarryh/Ark-Models](https://github.com/isHarryh/Ark-Models)                                         | game-archive |  3109 | 3095 | unverified-assets      |
| [phaserjs/examples](https://github.com/phaserjs/examples)                                             | examples     |   228 |   27 | mixed-assets-review    |
| [pixijs/spine](https://github.com/pixijs-userland/spine)                                              | runtime      |     0 |    0 | runtime-license        |
| [playcanvas/playcanvas-spine](https://github.com/playcanvas/playcanvas-spine)                         | runtime      |    12 |    4 | mit-code-assets-review |
| [respectZ/blue-archive-viewer](https://github.com/respectZ/blue-archive-viewer)                       | game-archive |   252 |  253 | unverified-assets      |

## Sélection initiale

Les exemples officiels sont importés localement pour l’étude ; leurs images sont non commerciales. rigc fournit code et documentation MIT, avec exceptions explicites pour bench/reference/. Ces exceptions sont exclues de l’import. Les archives communautaires sont indexées ; aucun droit de production commerciale ou d’entraînement n’est présumé.

La commande sources:fetch télécharge des références vers .local/references/ et les rend visibles dans le viewer. Le contenu original des guides téléchargés reste dans .local/references/guides/. Les fichiers de ces sources ne sont jamais exécutés. Pour Claude, utiliser le guide original dans docs/GUIDE-CLAUDE.md et les analyses learning/.

## Licence vérifiée

[Spine exemples coin](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/examples/coin/license.txt) : images non commerciales, projet déclaré domaine public. [Spine Animation AI](https://github.com/GenielabsOpenSource/spine-animation-ai/blob/main/LICENSE) : PolyForm Noncommercial. [rigc](https://github.com/rig-c/core/blob/main/LICENSE) : MIT pour ses propres code/docs/art, exceptions tierces. [Rev2D](https://github.com/RevStudio/Rev2D/blob/main/LICENSE) : MIT pour le dépôt, examiner les assets importés séparément.
