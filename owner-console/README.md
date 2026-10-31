# Console propriétaire GoodFly

Application **locale** (uniquement sur l'ordinateur du propriétaire) pour gérer les comptes Direction,
agents et clients. Elle n'est **jamais** déployée avec le site.

## Démarrer

```bash
npm run owner:demo     # essai avec des données fictives, code : demo
npm run owner          # vrai projet Supabase (voir configuration)
```

Puis ouvrir http://127.0.0.1:4000

## Configuration (une seule fois)

Dans **votre terminal** (jamais dans un chat ni un e-mail) :

```bash
npm run owner:setup
```

La commande demande, sans les afficher, la clé secrète Supabase
(Project settings → API keys → Secret key) et un nouveau code propriétaire,
puis les enregistre dans `owner-console/.env.local` (lisible par vous seul, ignoré par git).

Si une clé secrète a été montrée à quelqu'un ou collée quelque part : supprimez-la dans Supabase
et créez-en une nouvelle, puis relancez `npm run owner:setup`.

## Ce que fait la console

- Vue d'ensemble : comptes Direction (max 2 actifs), agents, clients, comptes suspendus, dernières actions.
- Inviter un compte Direction (e-mail d'invitation Supabase).
- Changer un rôle (Direction / agent / client), suspendre, réactiver, lien de réinitialisation du mot de passe.
- Supprimer définitivement (il faut retaper l'e-mail du compte).
- Purger les comptes suspendus depuis plus de 30 jours.
- Journal de toutes les actions (console et Direction).
- Le compte propriétaire n'est jamais modifiable depuis la console.

## Sécurité

- Écoute uniquement sur `127.0.0.1` et refuse tout autre nom d'hôte (pas d'accès depuis le réseau).
- Code propriétaire (stocké haché avec scrypt), blocage 15 min après 5 erreurs.
- Session en mémoire, cookie `HttpOnly` + `SameSite=Strict`, expiration après 30 min d'inactivité.
- Jeton CSRF et vérification de l'origine sur chaque action, politique CSP stricte, aucune ressource externe.
- La clé service-role contourne toutes les règles de la base : elle ne doit exister que dans `owner-console/.env.local`.

Tests : `npm run test:owner`
