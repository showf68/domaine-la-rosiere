# Domaine La Rosière — choix de la maquette (22/10/2026)

**Geste unique** : le visiteur voit la piscine chauffée dès le premier écran, comprend que la maison
entière accueille son groupe (jusqu'à 50 personnes), puis **demande un séjour**.
**Public** : familles (cousinades, fêtes), associations, entreprises en semaine ; beaucoup d'Allemands.
**Brief propriétaire** : « élégante, voire luxueuse », piscine au premier plan, FR + DE.

## Les trois pistes
| | v1 « La Demeure » | v2 « Bassin de nuit » | v3 « Les occasions » |
|---|---|---|---|
| Ossature | titre centré puis la piscine dans une **arche** qui s'ouvre au défilement ; longue page éditoriale | **écran partagé** texte / piscine plein cadre, bandeau de chiffres, mosaïques denses | **collage** de 4 photos + **sélecteur d'occasion** en tête, tuiles, tableau d'infos |
| Polices | Cormorant Garamond + Jost | Bodoni Moda + Manrope | Fraunces + Figtree |
| Couleurs | ivoire, vert profond (celui du logo), rose ancien | bleu nuit du bassin, aqua, marbre | blanc, sauge, vert, rose vif |
| Densité | aérée | dense | moyenne, très pratique |
| Signature | l'arche (porte d'entrée de la villa) qui s'élargit sur la piscine | reflets d'eau animés sur la photo du bassin | onglets Cousinade / Fête / Association / Entreprise |

Différences concrètes : v1→v2 = clair→sombre, arche centrée→écran partagé, sections aérées→mosaïques
serrées, empattements classiques→Didone. v1→v3 = page éditoriale→collage + onglets, filets fins→tuiles
arrondies, ivoire→blanc/sauge. v2→v3 = nuit→jour, mosaïque→tuiles, reflets→onglets.

## Recommandation : **v1 « La Demeure »**
1. C'est exactement la direction validée par le propriétaire au round 2 (ivoire et vert profond, élégant,
   grandes photos réelles) et le vert de **son logo** : il se reconnaîtra dedans.
2. La piscine est la première image et le seul moment animé de la page : l'arche reprend la porte cintrée
   de la façade et s'ouvre sur le bassin — le geste unique est porté par la mise en scène, pas par un slogan.
3. Lecture calme et lisible pour un public familial et associatif, en français comme en allemand ; c'est la
   seule des trois déjà **intégrée** (FR + DE, formulaire réel, visionneuse photos).

**Limite** : page longue, le formulaire est en bas (le bouton « Demander un séjour » de l'en-tête compense
sur ordinateur, mais il est replié dans le menu sur téléphone).
**Emprunt à v2** : le bouton « Demander un séjour » **collant en bas d'écran sur téléphone**.

**Quand préférer v2** : s'il veut un effet « hôtel-spa » plus spectaculaire, nocturne, très contemporain.
**Quand préférer v3** : si l'efficacité commerciale prime sur le prestige (le visiteur choisit d'abord son
occasion, toutes les infos tiennent sur un écran).

## Décision (22/10/2026, Yossef Haim) : « plutôt v3 mais faut améliorer encore »
Variante unique **v3b** (identité v3 gardée) devenue le site intégré `docs/index.html` + `docs/de/` :
- contenu complet repris de v1 (chambres par étage, jardins, alentours et sorties, galerie, infos détaillées) ;
- sélecteur d'occasion : vrais onglets accessibles (flèches clavier), contenu FR/DE dans la page, le bouton
  « Demander un séjour » de chaque occasion présélectionne l'occasion dans le formulaire ;
- piscine : duo de photos superposées au lieu d'une seule ; espaces en mosaïque (grande tuile + bandeau sport) ;
- demande de séjour réelle (mail prérempli), visionneuse plein écran sur toutes les photos ;
- bouton « Demander un séjour » collant sur téléphone (emprunt v2), masqué au-dessus du formulaire ;
- bouton rose foncé (#a8545f) au lieu du rose v3 : contraste suffisant pour le texte blanc.
La v1 reste consultable ici en maquette (`v1.html`, gabarit archivé `src/v1.template.html`).
