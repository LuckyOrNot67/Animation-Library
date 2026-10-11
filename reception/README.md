# Réception

Dépose directement un HAR nommé comme la machine : `gatorhunters2.har`, `Sugar Rush.har`, etc. Lance `npm run build` (ou `npm.cmd run build` sous PowerShell) depuis la racine du projet.

Le nom sans `.har` devient celui de la machine dans bibliotheque/. Le HAR doit inclure le contenu des réponses réseau, sinon les fichiers absents sont signalés. Il reste intact et n’est pas publié dans Git.

Tu peux aussi créer un sous-dossier par machine et y mettre un ou plusieurs HAR ou des fichiers décompressés. Les sources d’une même machine sont fusionnées et dédupliquées. Voir le README principal.
