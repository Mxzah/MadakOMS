# Comment fonctionnent les Application Fees dans Stripe Connect

## Exemple concret : Paiement de $100

### Situation actuelle (avec Transfers) ❌

**Paiement de $100 :**
1. Paiement collecté sur le compte principal : **$100.00**
2. Frais Stripe déduits du compte principal : **-$3.31** (2.9% + $0.30)
   - Compte principal reçoit : **$96.69**
3. Transfer de $100 au compte connecté : **-$100.00**
   - Compte principal : **-$3.31** (perte nette)
   - Compte connecté : **+$100.00**

**Résultat :**
- Compte principal : **-$3.31** (paie les frais)
- Compte connecté : **+$100.00** (reçoit tout)

**Problème :** Le compte principal paie tous les frais Stripe.

---

### Avec Application Fees ✅

**Paiement de $100 :**
1. Paiement collecté sur le compte principal : **$100.00**
2. Application fee gardée par la plateforme : **+$3.31** (ou plus si vous prenez une commission)
3. Montant transféré au compte connecté : **$96.69** (automatiquement)
4. Frais Stripe déduits du compte connecté : **-$3.31**
   - Compte connecté reçoit : **$93.38** net

**Résultat :**
- Compte principal : **+$3.31** (garde l'application fee, couvre les frais)
- Compte connecté : **+$93.38** (reçoit le montant net après frais)

**Avantage :** Les frais Stripe sont payés par le compte connecté (le restaurant), pas par la plateforme.

---

### Avec Application Fees + Transfer de l'application fee ✅✅

**Paiement de $100 :**
1. Paiement collecté sur le compte principal : **$100.00**
2. Application fee gardée par la plateforme : **+$3.31**
3. Montant transféré au compte connecté : **$96.69** (automatiquement)
4. Frais Stripe déduits du compte connecté : **-$3.31**
5. **Transfer de l'application fee au compte connecté : -$3.31** (sans frais supplémentaires)

**Résultat final :**
- Compte principal : **$0.00** (neutre)
- Compte connecté : **+$96.69** (montant initial transféré) - **$3.31** (frais) + **$3.31** (application fee transférée) = **$96.69 net**

**Avantage :** 
- ✅ Les frais Stripe sont payés par le compte connecté
- ✅ Le restaurant reçoit presque tout le montant ($96.69 au lieu de $93.38)
- ✅ Les transfers n'ont pas de frais Stripe (ce sont juste des mouvements de fonds)

---

## Détails techniques

### Création du PaymentIntent avec Application Fees

```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000, // $100.00 en centimes
  currency: 'cad',
  application_fee_amount: 331, // $3.31 en centimes (frais Stripe)
  transfer_data: {
    destination: 'acct_xxxxx', // Compte connecté du restaurant
  },
})
```

**Ce qui se passe :**
- Le paiement de $100 est collecté sur le compte principal
- $3.31 reste sur le compte principal (application fee)
- $96.69 est automatiquement transféré au compte connecté
- Les frais Stripe ($3.31) sont déduits du compte connecté
- Le restaurant reçoit $93.38 net

### Transfer de l'application fee au compte connecté (optionnel)

```javascript
// Après le paiement réussi, transférer l'application fee au compte connecté
const transfer = await stripe.transfers.create({
  amount: 331, // $3.31 en centimes (l'application fee)
  currency: 'cad',
  destination: 'acct_xxxxx', // Compte connecté
  metadata: {
    type: 'application_fee_refund',
    payment_intent_id: paymentIntent.id,
  },
})
```

**Important :** Les transfers n'ont **PAS de frais Stripe**. Ce sont juste des mouvements de fonds entre comptes.

---

## "Partagés" signifie quoi exactement ?

**"Partagés" ne veut PAS dire que les frais sont divisés entre les deux comptes.**

**"Partagés" signifie :**
- Les frais Stripe sont payés par le compte connecté (le restaurant)
- La plateforme garde l'application fee (qui peut être égale ou supérieure aux frais Stripe)
- Le compte principal ne paie PAS les frais Stripe

**Si vous transférez l'application fee :**
- Les frais Stripe sont toujours payés par le compte connecté
- Mais le restaurant reçoit l'application fee en plus
- Le compte principal reste neutre (pas de gain, pas de perte)

---

## Comparaison des scénarios

### Scénario 1 : Application Fees sans transfer
```
Client paie $100
  ↓
Compte principal : +$3.31 (application fee) ✅
Compte connecté : +$96.69 → -$3.31 (frais) = +$93.38 ✅
```

### Scénario 2 : Application Fees avec transfer de l'application fee
```
Client paie $100
  ↓
Compte principal : +$3.31 → -$3.31 (transfer) = $0.00 ✅
Compte connecté : +$96.69 → -$3.31 (frais) + $3.31 (transfer) = +$96.69 ✅
```

### Scénario 3 : Application Fees = 0 (pas de commission plateforme)
```
Client paie $100
  ↓
Compte principal : +$0.00 (pas d'application fee)
Compte connecté : +$100.00 → -$3.31 (frais) = +$96.69 ✅
```

**Note :** Le scénario 3 est plus simple si vous ne voulez pas de commission. Mais le scénario 2 vous donne plus de contrôle (vous pouvez décider de transférer ou non l'application fee).

---

## Avantages pour votre système multi-restaurants

1. **Chaque restaurant paie ses propres frais** : Les frais Stripe sont déduits du compte connecté, pas du compte principal
2. **Flexibilité** : Vous pouvez choisir de garder l'application fee ou de la transférer au restaurant
3. **Pas de confusion** : Chaque restaurant voit ses propres frais dans son tableau de bord Stripe
4. **Pas de frais doubles lors du remboursement** : Avec `reverse_transfer: true`, tout est reversé automatiquement
5. **Transfers sans frais** : Vous pouvez transférer l'application fee sans frais supplémentaires

---

## Conclusion

**Oui, vous pouvez transférer l'application fee au compte connecté sans frais supplémentaires.**

Les transfers entre comptes Stripe Connect n'ont pas de frais Stripe. C'est juste un mouvement de fonds.

**Options :**
1. **Garder l'application fee** : La plateforme gagne de l'argent (commission)
2. **Transférer l'application fee** : Le restaurant reçoit presque tout le montant ($96.69 au lieu de $93.38)
3. **Application fee = 0** : Le restaurant reçoit $96.69 directement (plus simple mais moins de contrôle)
