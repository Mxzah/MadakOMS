# Scripts Console

Ce dossier contient les scripts utilitaires pour gérer le projet en ligne de commande.

## Créer un compte Stripe Connect Express

### Utilisation

```bash
node scripts/create-stripe-account.js [options]
```

Ce script :
1. Crée un compte Stripe Connect Express
2. Génère un lien d'onboarding
3. **Ouvre automatiquement la page d'onboarding dans votre navigateur**

### Options

- `--email <email>` : Email pour le compte Express
- `--restaurant-slug <slug>` : Slug du restaurant à associer (optionnel)
- `--country <code>` : Code pays (défaut: `CA`)
- `--help, -h` : Afficher l'aide

### Exemples

**Créer un compte Express simple :**
```bash
node scripts/create-stripe-account.js --email restaurant@example.com
```

**Créer un compte Express et l'associer à un restaurant :**
```bash
node scripts/create-stripe-account.js --email restaurant@example.com --restaurant-slug sante-taouk
```

**Créer un compte Express pour un autre pays :**
```bash
node scripts/create-stripe-account.js --email restaurant@example.com --country US
```

### Prérequis

Le script nécessite les variables d'environnement suivantes dans `.env.local` :

- `STRIPE_SECRET_KEY` : Clé secrète Stripe (requis)
- `SUPABASE_URL` : URL de votre instance Supabase (optionnel, pour associer au restaurant)
- `SUPABASE_SERVICE_ROLE_KEY` : Clé de service Supabase (optionnel, pour associer au restaurant)
- `NEXT_PUBLIC_APP_URL` : URL de votre application (optionnel, pour le lien d'onboarding, défaut: `http://localhost:3000`)

### Résultat

Le script :
1. Crée le compte Stripe Connect Express
2. Affiche les informations du compte (ID, type, pays, email)
3. **Ouvre automatiquement la page d'onboarding Stripe dans votre navigateur**
4. Affiche les instructions pour compléter l'onboarding

### Prochaines étapes

Une fois la page d'onboarding ouverte dans votre navigateur :

1. Complétez les informations du compte
2. Ajoutez un compte bancaire de test (pour le mode test Stripe)
3. Acceptez les conditions d'utilisation
4. Une fois complété, le compte pourra recevoir des paiements

### Notes

- Le script ouvre automatiquement le navigateur par défaut de votre système
- Si l'ouverture automatique échoue, le lien sera affiché dans la console
- En mode test Stripe, vous pouvez utiliser n'importe quelles informations de test
- Le compte doit compléter l'onboarding avant de pouvoir recevoir des paiements

