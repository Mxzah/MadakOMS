# Solutions pour les Frais Stripe Connect

## Problèmes Identifiés

### Problème 1 : Frais sur le compte principal
- Les paiements sont collectés sur le compte principal
- Les frais Stripe (2.9% + 0.30$) sont déduits du compte principal
- Difficile de gérer les frais par restaurant dans un système multi-restaurants

### Problème 2 : Frais doubles lors du remboursement
- Frais initiaux déduits du compte principal lors du paiement
- Frais déduits du compte connecté lors du reversal du transfer
- Résultat : frais payés deux fois

## Solutions Proposées

### Solution 1 : Application Fees (RECOMMANDÉE) ⭐

**Comment ça fonctionne :**
- Créer le PaymentIntent sur le compte principal avec `application_fee_amount`
- Les frais Stripe sont automatiquement partagés entre les deux comptes
- Le compte connecté reçoit le montant net (montant - application_fee)
- Lors du remboursement, utiliser `reverse_transfer: true` pour reverser automatiquement

**Avantages :**
- ✅ Frais correctement répartis (pas de frais sur le compte principal uniquement)
- ✅ Pas de frais doubles lors du remboursement
- ✅ Facile de calculer la commission de la plateforme
- ✅ Compatible avec le système actuel (paiements sur compte principal)

**Inconvénients :**
- ⚠️ Nécessite de calculer l'application_fee (montant - frais Stripe estimés)

**Exemple :**
```javascript
// Paiement de $100
// Frais Stripe : $3.31 (2.9% + $0.30)
// Application fee : $3.31 (ou plus si vous prenez une commission)
// Montant transféré au restaurant : $96.69

const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000, // $100 en centimes
  currency: 'cad',
  application_fee_amount: 331, // $3.31 en centimes
  transfer_data: {
    destination: 'acct_xxxxx', // Compte connecté
  },
})
```

---

### Solution 2 : Direct Charges avec on_behalf_of

**Comment ça fonctionne :**
- Créer le PaymentIntent directement sur le compte connecté avec `on_behalf_of`
- Les frais sont directement sur le compte connecté
- Pas besoin de transfer

**Avantages :**
- ✅ Frais directement sur le compte connecté
- ✅ Pas de transfer nécessaire
- ✅ Pas de frais doubles

**Inconvénients :**
- ❌ Nécessite de créer le PaymentMethod sur le compte connecté (problème qu'on avait avant)
- ❌ Plus complexe à implémenter
- ❌ Nécessite de modifier le flow de paiement côté client

---

### Solution 3 : Calculer et déduire les frais lors du transfer

**Comment ça fonctionne :**
- Calculer les frais Stripe (2.9% + 0.30$)
- Transférer seulement le montant net (montant - frais) au compte connecté
- Garder les frais sur le compte principal

**Avantages :**
- ✅ Simple à implémenter
- ✅ Les frais restent sur le compte principal

**Inconvénients :**
- ❌ Les frais sont toujours sur le compte principal (problème 1 non résolu)
- ❌ Lors du remboursement, on reverse le montant net mais les frais initiaux restent
- ❌ Pas de solution pour les frais doubles

---

## Recommandation : Solution 1 (Application Fees)

La **Solution 1 (Application Fees)** est la meilleure car :
1. Résout les deux problèmes (frais sur compte principal + frais doubles)
2. Compatible avec votre architecture actuelle
3. Standard Stripe pour les plateformes multi-vendeurs
4. Facilite la gestion de la commission de la plateforme

## Implémentation de la Solution 1

### Étape 1 : Modifier la création du PaymentIntent

Au lieu de créer un PaymentIntent simple puis transférer, créer un PaymentIntent avec `application_fee_amount` et `transfer_data`.

### Étape 2 : Modifier le remboursement

Utiliser `reverse_transfer: true` lors du remboursement pour reverser automatiquement l'application fee.

### Étape 3 : Calculer l'application fee

```javascript
// Calculer les frais Stripe
const stripeFee = Math.round(amount * 0.029 + 30) // 2.9% + $0.30
// Optionnel : Ajouter votre commission
const platformFee = Math.round(amount * 0.05) // 5% de commission
const applicationFeeAmount = stripeFee + platformFee
```

## Migration

La migration nécessite :
1. Modifier `create-payment-intent.js` pour utiliser `application_fee_amount`
2. Supprimer ou modifier `transfer-to-connect.js` (plus besoin de transfer séparé)
3. Modifier `cancel-payment.js` pour utiliser `reverse_transfer: true`

