# GoodFly 2.0

Nouveau site de l'agence GoodFly — concept « Quiet Luxury Aviation ».
Le site actuel goodfly.ma n'est pas concerné par ce dépôt.

Maquette approuvée : https://claude.ai/artifact/4cWzjtHn2moST5oKbCXA49

## Lancer le projet

```bash
npm install
npm run dev            # http://localhost:3000 → redirige vers /fr
```

## Tests

```bash
npm run test:db        # règles des comptes (Postgres en mémoire, aucun service en ligne)
npm run build          # nécessaire avant les tests navigateur
npm run test:e2e       # Playwright, bureau 1440 px + mobile 390 px
npm run test:owner     # console propriétaire (sécurité + règles, navigateur réel)
npm run test:staff     # statistiques de l'espace Direction
npm test               # tout
```

## Organisation

| Dossier | Contenu |
|---|---|
| `src/app/[lang]` | Pages `/fr` et `/ar` (l'arabe s'affiche de droite à gauche) |
| `src/i18n` | Textes français et arabes |
| `src/config/site.ts` | Aéroport de départ par défaut (RBA) et destinations d'exemple |
| `src/components/hero` | Page d'accueil : emblème soleil-mer du logo (SVG animé), titres, boutons, barre de réservation |
| `src/components/aircraft3d` | Avion 3D mis de côté (non utilisé pour l'instant, voir son README) |
| `src/components/sections` | Sections de la page d'accueil |
| `src/app/globals.css` | Couleurs, typographie, espacements, mouvement (thèmes clair et sombre) |
| `supabase/migrations` | Rôles et règles des comptes |
| `owner-console/` | Console propriétaire, locale uniquement (`npm run owner:demo`) — voir son README |
| `src/app/[lang]/espace` | Espace Direction : connexion, vue d'ensemble, comptes, journal, mon compte |
| `src/lib/staff`, `src/lib/supabase` | Accès aux données Direction (vérification à chaque page) et clients Supabase |

## Avion 3D (mis de côté)

Pas utilisé sur le site pour l'instant (décision du 30/10/2026 : finir le site d'abord). Tout est conservé pour le réactiver plus tard.
Modèle original GoodFly (aucun modèle tiers, aucune licence) : long-courrier biréacteur généré par code.

```bash
npm run build:aircraft   # régénère les GLB + les 4 images fixes
npm run test:model       # vérifie tailles, compression, structure
```

| Fichier | Usage | Poids |
|---|---|---|
| `public/models/goodfly-airliner.glb` | Ordinateur | ~380 Ko, ~44 000 triangles |
| `public/models/goodfly-airliner-lite.glb` | Téléphone / appareil modeste | ~160 Ko, ~11 000 triangles |
| `public/aircraft/poster-{light,dark}-{ltr,rtl}.webp` | Première image + version « animations réduites » | ~25 Ko chacune |

- Source : `scripts/aircraft/` (géométrie, textures PBR, export glTF, rendu des images fixes).
- Compression : géométrie meshopt, textures WebP. Police du logo : Manrope (licence OFL, `scripts/aircraft/fonts/OFL.txt`).
- Réglages partagés site ↔ images fixes : `src/components/hero/sceneConfig.json` (caméra, lumières) et `skyEnvironment.js` (reflets du ciel).
- Qualité automatique : haute / moyenne / basse selon l'appareil, et baisse automatique si l'animation ralentit.

## Comptes et droits

| Rôle | Rapports | Agents et clients | Son propre compte | L'autre compte Direction |
|---|---|---|---|---|
| Direction (X, Y) | Tout voir | Modifier, désactiver, restaurer | Modifier | Interdit |
| Propriétaire | Tout | Tout | Tout | Modifier et désactiver |

- Les règles sont appliquées dans la base (RLS + fonctions), pas seulement à l'écran.
- « Supprimer » un compte = le désactiver ; il reste récupérable 30 jours.
- Le propriétaire utilise la console locale `owner-console/` (sur son PC uniquement) avec la clé service-role.
  Cette clé ne doit jamais être déployée sur le site.

## Mouvement et accessibilité

- Page d'accueil : vagues et petit avion animés en CSS/SVG (aucun JavaScript, aucun modèle 3D chargé).
- Avec « réduire les animations » activé : emblème immobile, pas d'épinglage des destinations.

## Encore provisoire

- Photos, films, numéro WhatsApp, adresse et licence de l'agence : à fournir.
- Destinations : exemples, non confirmés.
- Espace Direction : prêt (`/fr/espace`). Les rapports de réservation viendront avec la réservation en ligne.
- Réservation en ligne : phase suivante.
- Console propriétaire : prête et reliée au projet Supabase GoodFly (`npm run owner`).
