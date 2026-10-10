# Lire une animation comme référence

1. Lire bibliotheque/catalogue.json : machines, packages, formats, versions et actions.
2. Ouvrir metadata.json du package : os, slots, skins, textures, régions et warnings. Ne pas considérer une association incertaine comme une correspondance garantie.
3. Ouvrir skeleton.json : hiérarchie des bones, attachments, contraintes, meshes, animations et courbes. Les vertices/weights/UV expliquent comment les morceaux sont déformés.
4. Examiner pieces/ et les planches de texture originales. metadata.json associe les pièces à leur région et page ; les propriétés indiquent rotation, bounds et offsets.
5. Lire actions/<nom>/animation.json : durée, résumé des timelines et données de l’action. Le skeleton parent garde le rig complet et toutes les skins ; une timeline seule ne suffit pas à jouer l’animation.
6. Lancer npm start pour observer les mouvements et changer d’action/skin. Les avertissements et manifest.json expliquent les ressources manquantes ou écartées.

Les exports ne contiennent pas le code source de gameplay ni forcément le projet Spine d’auteur. On peut analyser une animation et reproduire sa technique avec ses propres assets ; on ne peut pas déduire un code original absent. Les découpes contiennent toutes les régions des atlas associés, donc potentiellement celles d’autres rigs partageant la même planche.

Ne pas reconstruire la bibliothèque sans reception/ : les sources brutes sont volontairement locales. Les packages finaux sont suivis dans Git. Les imports bruts restent locaux ; consulter docs/GITHUB.md pour la publication.
