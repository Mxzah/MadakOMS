# Configuration Stripe (Mode Sandbox)

Ce document explique comment configurer Stripe en mode sandbox pour le système de paiement.

## Prérequis

1. Un compte Stripe (gratuit) - [https://stripe.com](https://stripe.com)
2. Accès au tableau de bord Stripe en mode test

## Étapes de configuration

### 1. Obtenir les clés API Stripe

1. Connectez-vous à votre compte Stripe
2. Allez dans **Developers** > **API keys**
3. Assurez-vous d'être en mode **Test mode** (bascule en haut à droite)
4. Copiez les clés suivantes :
   - **Publishable key** (commence par `pk_test_...`)
   - **Secret key** (commence par `sk_test_...`)

### 2. Configurer les variables d'environnement

Ajoutez les clés Stripe à votre fichier `.env.local` :

```env
# Stripe Configuration (Mode Sandbox/Test)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_votre_cle_publique_ici
STRIPE_SECRET_KEY=sk_test_votre_cle_secrete_ici
```

**Important :**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` est exposée au client (préfixe `NEXT_PUBLIC_`)
- `STRIPE_SECRET_KEY` doit rester secrète et n'est utilisée que côté serveur

### 3. Redémarrer le serveur de développement

Après avoir ajouté les variables d'environnement, redémarrez votre serveur Next.js :

```bash
npm run dev
```

## Test des paiements

### Restrictions de paiement

**⚠️ Important :**
- Seules les cartes émises au Canada sont acceptées
- Les cartes prépayées ne sont pas acceptées (seules les cartes de crédit et de débit sont acceptées)

### Cartes de test Stripe

En mode sandbox, utilisez les cartes de test suivantes :

**Paiement réussi (carte canadienne) :**
- Numéro : `4000 0012 4000 0000` (carte Visa canadienne)
- Date d'expiration : n'importe quelle date future (ex: `12/34`)
- CVC : n'importe quel 3 chiffres (ex: `123`)
- Code postal : n'importe quel code postal canadien valide (ex: `G9P 4G2`)

**Paiement réussi (carte générique - peut fonctionner) :**
- Numéro : `4242 4242 4242 4242`
- Date d'expiration : n'importe quelle date future (ex: `12/34`)
- CVC : n'importe quel 3 chiffres (ex: `123`)
- Code postal : n'importe quel code postal valide

**Paiement refusé :**
- Numéro : `4000 0000 0000 0002`

**3D Secure (authentification requise) :**
- Numéro : `4000 0025 0000 3155`

**Note :** Le système vérifie automatiquement le pays d'émission de la carte. Si une carte non-canadienne est utilisée, un message d'erreur s'affichera : "Seules les cartes émises au Canada sont acceptées."

Pour plus de cartes de test, consultez la [documentation Stripe](https://stripe.com/docs/testing).

## Fonctionnement

1. **Création du PaymentIntent** : Quand l'utilisateur ouvre le modal de carte, un PaymentIntent est créé automatiquement via `/api/stripe/create-payment-intent`

2. **Saisie de la carte** : L'utilisateur saisit ses informations de carte via Stripe Elements (sécurisé, conforme PCI)

3. **Création du PaymentMethod** : Dès que les informations de carte sont complètes et valides, un PaymentMethod est créé automatiquement

4. **Confirmation du paiement côté client** : Lors de la soumission de la commande, le paiement est confirmé côté client avec `stripe.confirmCardPayment()` :
   - **Si 3D Secure est requis** : Stripe redirige automatiquement l'utilisateur vers la page d'authentification de sa banque
   - L'utilisateur complète l'authentification (code SMS, app bancaire, etc.)
   - Une fois authentifié, le paiement est confirmé
   - **Si 3D Secure n'est pas requis** : Le paiement est confirmé immédiatement

5. **Création de la commande** : Une fois le paiement confirmé (statut `succeeded`), la commande est créée dans la base de données avec le paiement déjà validé

6. **Enregistrement** : Les informations du paiement (PaymentIntent ID, statut `paid`) sont enregistrées dans la table `payments` de la base de données

### Support 3D Secure

Le système supporte automatiquement le 3D Secure (authentification forte) :
- ✅ Gestion automatique de la redirection vers la banque
- ✅ Support de toutes les méthodes d'authentification (SMS, app bancaire, etc.)
- ✅ Le paiement n'est confirmé qu'après authentification réussie
- ✅ La commande n'est créée que si le paiement est confirmé avec succès

## Passage en production

Pour passer en production :

1. Basculez en mode **Live mode** dans le tableau de bord Stripe
2. Remplacez les clés de test par les clés de production :
   - `pk_test_...` → `pk_live_...`
   - `sk_test_...` → `sk_live_...`
3. Mettez à jour les variables d'environnement
4. Testez avec de vraies cartes (en commençant par de petits montants)

## Sécurité

- ✅ Les données de carte ne transitent jamais par votre serveur
- ✅ Stripe Elements gère la conformité PCI
- ✅ Les clés secrètes ne sont jamais exposées au client
- ✅ Les paiements sont traités de manière sécurisée par Stripe

## Support

Pour plus d'informations :
- [Documentation Stripe](https://stripe.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Elements](https://stripe.com/docs/payments/elements)

