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

#### Option A : Compte Express (Recommandé pour commencer)
Les comptes Express sont les plus simples à configurer et permettent aux restaurants de se connecter rapidement.

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

### Création d'un PaymentIntent

Lorsqu'un client passe une commande :

1. Le système récupère le `stripe_account_id` du restaurant depuis `restaurant_settings`
2. Si un `stripe_account_id` est trouvé, le PaymentIntent est créé sur ce compte Stripe Connect
3. Si aucun `stripe_account_id` n'est configuré, le PaymentIntent est créé sur le compte principal de la plateforme

### Annulation et remboursement

Lorsqu'une commande est annulée :

1. Le système récupère le `stripe_account_id` du restaurant depuis la commande
2. Les opérations de remboursement/annulation sont effectuées sur le bon compte Stripe Connect

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

### Erreur "No such account"

1. Vérifiez que l'`account_id` est correct (format: `acct_xxxxx`)
2. Vérifiez que le compte existe dans votre tableau de bord Stripe
3. Vérifiez que vous utilisez les bonnes clés API (test vs production)

## Documentation Stripe

Pour plus d'informations :
- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Connected Accounts](https://stripe.com/docs/connect/accounts)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)

