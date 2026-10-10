# Nouveau dépôt GitHub

Ce projet possède son propre dépôt Git local, indépendant de Scrap. Aucun remote n’est configuré tant que le dépôt cible n’est pas choisi.

La bibliothèque finale est incluse : une IA pourra consulter catalogue.json, les packages, les actions et leurs images directement dans le dépôt. Les imports bruts reception/, node_modules/, HAR et fichiers locaux sont exclus.

```bash
npm ci
npm test
npm run check
git status --short
git remote add origin https://github.com/COMPTE/DEPOT.git
git push -u origin main
```

Ces commandes ne créent pas le dépôt distant. Choisir le compte, le nom et la visibilité avant le premier push. Après de nouvelles captures, reconstruire puis ajouter explicitement les changements de bibliotheque/ au prochain commit.

Le dépôt peut contenir de nombreux visuels ; utiliser un dépôt privé si les captures sont destinées à l’étude interne. Un fichier dépassant 100 Mio devra passer par Git LFS ou être exclu. Les images partagées entre packages sont dédupliquées par Git à contenu identique.
