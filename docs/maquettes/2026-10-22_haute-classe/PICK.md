# Domaine La Rosière — maquettes « haute classe » (22/10/2026, round 9)

Retour de Yossef Haim sur v3b : « moche comme tout » / « je veux haute classe ». Diagnostic : look « appli »
(tuiles arrondies, sauge, pastilles) et photos de téléphone brutes. Ce round change les deux :
- **photos étalonnées** (`tools/grade.py` : dominante neutralisée, léger réchauffement, noirs relevés,
  courbe douce, saturation -12 %) — couleur seulement, aucun contenu ajouté ni retiré ;
- **vidéos de l'album** (drone au coucher du soleil, piscine) montées en boucles muettes de 8-9 s,
  version 1920 et version téléphone 960 px, chargement différé hors premier écran.
Étalon : sites d'hôtels Relais & Châteaux / Aman / Belmond.

| | A « Demeure » | B « Nocturne » | C « Galerie » |
|---|---|---|---|
| Ossature | vidéo drone plein écran, page éditoriale alternée, rail de chambres, bandeau vidéo des champs | titre géant sur la vidéo piscine, **récit à colonne fixe** (le texte change pendant que les photos défilent), cartes photo | **photo en passe-partout**, grille d'architecte 12 colonnes, fiche « En bref », bandeau cinéma 21:9 |
| Polices | EB Garamond + Jost | Bodoni Moda + Manrope | Instrument Serif + Inter Tight |
| Couleurs | ivoire, vert du logo, laiton | nuit vert-noir, os, laiton | pierre, encre, olive |
| Densité | aérée | aérée, immersive | très clairsemée |
| Signature | la maison qui s'élève dans les champs dorés (drone) | « La Rosière » en Bodoni italique géant sur l'eau | images qui se dévoilent comme un rideau |

## Recommandation : **A « Demeure »**
1. Le premier écran montre **la maison dans son paysage** (drone au coucher du soleil), puis la piscine en
   mouvement : les deux arguments qui vendent, dans l'ordre où un visiteur les veut.
2. Vert du logo + ivoire + typographie classique : « élégante, voire luxueuse » comme demandé par le
   propriétaire, sans tomber dans l'effet « spa de nuit » qui ne correspond pas à une maison de famille.
3. Lisible pour tous ses publics (familles, associations, groupes allemands) et sur téléphone.

**Limite** : la page est lourde en vidéo (≈ 5 Mo au premier écran sur ordinateur, ≈ 1,5 Mo sur téléphone).
**Emprunt à B** : les cartes photo des occasions, plus parlantes sur téléphone que la liste.
**B si** il veut l'effet le plus spectaculaire (soirées, séminaires, clientèle jeune).
**C si** il préfère la sobriété absolue d'une galerie d'architecture, avec un minimum de texte.

## Round 10 — Yossef Haim : « plutôt A, mais c'est trop gros : plus fin, plus beau, mieux organisé » (+ /brain)
Brainstorm Codex (`thread 01a16576-36b7-7300-a9fe-609c6cf01292`) puis variante unique **A2** :
- échelle typographique au ratio 1,2 (titre 3,58rem au lieu de 5,6 ; titres de section 2,49rem au lieu de 4,2 ;
  corps 16 px Jost 400) ; capitales espacées à 0,08–0,1em au lieu de 0,24–0,5em ; italique réservé ;
- **une seule vidéo automatique** (le drone) ; la piscine en photo, sa vidéo à la demande ; galerie de
  24 photos à la demande ; 13 photos visibles dans la page au lieu d'une vingtaine ;
- 9 séquences : héros · présentation · piscine · maison · chambres (+ détail des couchages chambre par
  chambre, repris du descriptif du propriétaire) · jardins (vraies photos, plus le drone des champs) ·
  occasions (4 textes visibles, plus d'accordéon) · accès et pratique (fusionnés) · demande ;
- 3 espacements seulement (96 / 40 / 16–24 px) ; FR/DE visible sur téléphone ; barre basse
  « Demander un séjour » sur téléphone, masquée au-dessus du formulaire.
