# Corpus lisible par Claude

`npm run learn` reconstruit :

- index.json : packages, formats, droits, complexité, chemins vers les cas.
- actions.jsonl : un enregistrement par action identifiée, recherche progressive.
- cases/<id>/analysis.json : bone/slot/attachment/région/atlas, actions et métadonnées.
- cases/<id>/README.md : lecture courte du cas.

Les références tierces téléchargées sont locales et leurs cas détaillés sont exclus de Git. Pour les reconstruire après clone, lancer sources:fetch puis learn. Les droits s’appliquent aux assets indépendamment de la licence du code. Les fichiers SKEL ne sont pas décodés et leurs actions ne sont pas inventées.

Un index n’entraîne pas Claude : il permet de retrouver et étudier les bons exemples dans le contexte. Les nombres de packages/actions ne sont pas un score de qualité studio.
