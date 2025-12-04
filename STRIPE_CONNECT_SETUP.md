# Configuration Stripe Connect

Ce document explique comment configurer Stripe Connect pour permettre à chaque restaurant d'avoir son propre compte Stripe.

## Vue d'ensemble

Avec Stripe Connect, chaque restaurant peut avoir son propre compte Stripe indépendant. Cela permet :
- Chaque restaurant gère ses propres paiements
- Les fonds peuvent être versés directement au restaurant
- Chaque restaurant a son propre tableau de bord Stripe
- Meilleure séparation des responsabilités et de la comptabilité

## Architecture

Le système utilise **Stripe Connect avec des comptes connectés (Connected Accounts)**. La plateforme (votre compte principal) agit comme la plateforme, et chaque restaurant est un compte connecté.

### Modèle de flux de fonds

**Important :** Lors de la création d'un compte Stripe Connect, choisissez l'option **"Sellers will collect payments directly"** (les vendeurs collectent les paiements directement).

Ce modèle signifie que :
- Les paiements sont créés directement sur le compte Stripe Connect du restaurant
- Les fonds vont directement au restaurant (pas à la plateforme puis transfert)
- Chaque restaurant gère ses propres paiements et remboursements
- La plateforme facilite les transactions mais n'est pas l'intermédiaire financier

C'est le modèle le plus simple et le plus direct pour votre cas d'usage.

## Configuration

### 1. Créer un compte Stripe Connect pour un restaurant

#### Option A : Via l'API (Recommandé pour les tests)

Une route API est disponible pour créer automatiquement un compte Express Stripe Connect :

```bash
POST /api/stripe/create-express-account
Content-Type: application/json

{
  "restaurantSlug": "sante-taouk",  // Optionnel : associe automatiquement le compte au restaurant
  "email": "restaurant@example.com"  // Optionnel : email pour le compte
}
```

**Réponse :**
```json
{
  "success": true,
  "account": {
    "id": "acct_xxxxx",
    "type": "express",
    "country": "CA",
    "chargesEnabled": false,
    "detailsSubmitted": false
  },
  "onboardingLink": "https://connect.stripe.com/setup/...",
  "message": "Compte Express créé avec succès. Utilisez le lien d'onboarding pour compléter la configuration."
}
```

**Étapes suivantes :**
1. Utilisez le `onboardingLink` pour compléter l'onboarding du compte
2. Ajoutez un compte bancaire et acceptez les conditions d'utilisation
3. Une fois l'onboarding complété, le compte sera automatiquement utilisé pour les paiements

**Exemple d'utilisation dans le navigateur :**
```javascript
fetch('/api/stripe/create-express-account', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    restaurantSlug: 'sante-taouk',
    email: 'restaurant@example.com'
  })
})
.then(res => res.json())
.then(data => {
  if (data.error) {
    console.error('Erreur:', data.error, data.details)
    alert('Erreur: ' + data.error + (data.details ? '\n' + data.details : ''))
    return
  }
  if (data.success && data.account) {
    console.log('Compte créé:', data.account.id)
    if (data.onboardingLink) {
      window.open(data.onboardingLink, '_blank')
    }
  } else {
    console.error('Réponse inattendue:', data)
  }
})
.catch(error => {
  console.error('Erreur réseau:', error)
  alert('Erreur réseau: ' + error.message)
})
```

#### Option B : Via le tableau de bord Stripe

1. Dans votre tableau de bord Stripe, allez dans **Connect > Comptes**
2. Cliquez sur **Créer un compte**
3. Choisissez **Compte Express**
4. **IMPORTANT :** Lors de la configuration, choisissez **"Sellers will collect payments directly"** (option du haut)
   - Cette option permet aux restaurants de recevoir les paiements directement
   - Les fonds vont directement au restaurant, pas à la plateforme
5. Remplissez les informations du restaurant
6. Une fois créé, vous obtiendrez un `account_id` (format: `acct_xxxxx`)

#### Option B : Compte Standard
Les comptes Standard offrent plus de contrôle mais nécessitent plus de configuration.

#### Option C : Compte Custom
Les comptes Custom offrent le maximum de contrôle mais sont plus complexes à mettre en place.

### 2. Enregistrer le compte Stripe Connect dans la base de données

Une fois que vous avez le `account_id` du restaurant, mettez à jour la base de données :

```sql
-- Remplacer 'uuid-du-restaurant' par l'ID UUID du restaurant
-- Remplacer 'acct_xxxxx' par l'ID du compte Stripe Connect
UPDATE public.restaurant_settings
SET stripe_account_id = 'acct_xxxxx'
WHERE restaurant_id = 'uuid-du-restaurant';
```

### 3. Vérifier la configuration

Vous pouvez vérifier qu'un restaurant a un compte Stripe Connect configuré :

```sql
SELECT 
  r.name,
  r.slug,
  rs.stripe_account_id
FROM restaurants r
LEFT JOIN restaurant_settings rs ON r.id = rs.restaurant_id
WHERE rs.stripe_account_id IS NOT NULL;
```

## Fonctionnement

### Collecte des paiements et transfers

**Architecture actuelle :**

1. **Collecte des paiements** : Tous les paiements sont collectés sur le compte principal de la plateforme
   - Cela permet d'utiliser les éléments Stripe côté client sans problème de compatibilité
   - Le PaymentMethod est créé sur le compte principal et peut être utilisé directement

2. **Transfer vers le compte Connect** : Après confirmation du paiement et création de la commande
   - Le système vérifie si le restaurant a un compte Stripe Connect configuré
   - Si oui, les fonds sont automatiquement transférés vers le compte Connect du restaurant
   - Le transfer est effectué de manière asynchrone pour ne pas bloquer le processus de commande

**Avantages de cette approche :**
- Compatibilité totale avec les éléments Stripe côté client
- Gestion automatique du 3D Secure
- Transfers automatiques vers les comptes Connect
- Pas de problème de compatibilité entre PaymentMethod et PaymentIntent

### Annulation et remboursement

Lorsqu'une commande est annulée :

1. Le système récupère le `stripe_account_id` du restaurant depuis la commande
2. Si un transfer a été effectué, le remboursement est fait depuis le compte Connect
3. Sinon, le remboursement est fait depuis le compte principal

## Variables d'environnement

Assurez-vous d'avoir configuré :

```env
# Clé secrète de votre compte Stripe principal (plateforme)
STRIPE_SECRET_KEY=sk_test_xxxxx

# Clé publique (pour le frontend)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

**Note importante** : Même si chaque restaurant a son propre compte Stripe Connect, vous utilisez toujours les clés API de votre compte principal (plateforme) pour effectuer les opérations. Stripe gère automatiquement le routage vers le bon compte connecté.

## Migration depuis un compte unique

Si vous avez déjà des restaurants qui utilisent le compte Stripe principal :

1. Les commandes existantes continueront de fonctionner
2. Pour migrer un restaurant vers son propre compte :
   - Créez un compte Stripe Connect pour le restaurant
   - Mettez à jour `restaurant_settings.stripe_account_id`
   - Les nouvelles commandes utiliseront automatiquement le nouveau compte

## Gestion des fonds

### Avec des comptes Express/Standard

Les fonds sont automatiquement versés au compte du restaurant selon le calendrier configuré dans Stripe Connect.

### Avec des comptes Custom

Vous pouvez contrôler précisément quand et comment les fonds sont transférés au restaurant.

## Test en mode sandbox

En mode test, vous pouvez créer des comptes Stripe Connect de test :

1. Dans le tableau de bord Stripe (mode test), allez dans **Connect > Comptes**
2. Créez un compte Express de test
3. Utilisez l'`account_id` de test dans votre base de données

Les paiements de test sur un compte connecté fonctionnent de la même manière que sur le compte principal.

## Dépannage

### Le PaymentIntent n'utilise pas le compte Stripe Connect

1. Vérifiez que `stripe_account_id` est bien enregistré dans `restaurant_settings`
2. Vérifiez que le `restaurantSlug` est bien passé à l'API `create-payment-intent`
3. Consultez les logs du serveur pour voir si le compte est détecté

### Erreur "No such account" ou 404 lors de la confirmation

1. Vérifiez que l'`account_id` est correct (format: `acct_xxxxx`)
2. Vérifiez que le compte existe dans votre tableau de bord Stripe
3. Vérifiez que vous utilisez les bonnes clés API (test vs production)

### Erreur 404 lors de la confirmation du PaymentIntent

**Problème** : Le compte Stripe Connect n'est pas activé pour recevoir des paiements.

**Symptômes** :
- Erreur `404 (Not Found)` lors de la confirmation du PaymentIntent
- Le PaymentIntent est créé mais ne peut pas être confirmé

**Causes possibles** :
- Le compte n'a pas complété l'onboarding Stripe Connect
- `charges_enabled` est `false` dans les paramètres du compte
- `details_submitted` est `false` (informations manquantes)
- Les capacités de paiement par carte sont inactives (`card_payments: "inactive"`)

**Solution** :
1. Allez dans le tableau de bord Stripe > Connect > Comptes
2. Sélectionnez le compte concerné
3. Complétez tous les champs requis (marqués comme "Currently due" ou "Past due")
4. Vérifiez que `charges_enabled` est `true` et `details_submitted` est `true`
5. Activez les capacités de paiement par carte si nécessaire

**Note** : Le système vérifie automatiquement si le compte est activé avant de créer un PaymentIntent dessus. Si le compte n'est pas activé, le système utilise automatiquement le compte principal de la plateforme comme fallback.

### Transfer des fonds vers le compte Connect

**Fonctionnement automatique :**

Après qu'un paiement est confirmé et qu'une commande est créée, le système transfère automatiquement les fonds vers le compte Stripe Connect du restaurant (si configuré).

**API Route :**
```bash
POST /api/stripe/transfer-to-connect
Content-Type: application/json

{
  "orderId": "uuid-de-la-commande",
  "restaurantSlug": "sante-taouk"  // Optionnel
}
```

**Réponse :**
```json
{
  "success": true,
  "transfer": {
    "id": "tr_xxxxx",
    "amount": 14.94,
    "currency": "cad",
    "destination": "acct_xxxxx",
    "status": "paid"
  },
  "message": "Transfer effectué avec succès"
}
```

**Cas particuliers :**
- Si aucun compte Connect n'est configuré : Les fonds restent sur le compte principal
- Si le compte Connect n'est pas activé : Les fonds restent sur le compte principal
- Si un transfer a déjà été effectué : Retourne le transfer existant (idempotent)

**Note** : Le transfer est effectué de manière asynchrone après la création de la commande, donc il ne bloque pas le processus de commande. Si le transfer échoue, cela est loggé mais n'affecte pas la commande.

## Documentation Stripe

Pour plus d'informations :
- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Connected Accounts](https://stripe.com/docs/connect/accounts)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)

