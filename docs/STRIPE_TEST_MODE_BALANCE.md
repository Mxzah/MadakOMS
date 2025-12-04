# Stripe Test Mode - Gestion du Solde

## Erreur "balance_insufficient" en Mode Test

### Problème

Lors du transfer de l'application fee vers le compte Stripe Connect, vous pouvez rencontrer l'erreur suivante :

```
StripeInvalidRequestError: You have insufficient available funds in your Stripe account.
```

**C'est normal en mode test !** Cette erreur n'affecte pas le fonctionnement du système :
- ✅ Les paiements fonctionnent correctement
- ✅ Les remboursements fonctionnent correctement
- ✅ Le montant principal est transféré automatiquement au compte Connect
- ⚠️ Seul le transfer de l'application fee échoue (il reste sur le compte principal)

### Pourquoi cette erreur se produit ?

En mode test Stripe, le compte principal doit avoir des **fonds disponibles** pour pouvoir effectuer des transfers vers les comptes Connect. Par défaut, un compte Stripe en mode test n'a pas de fonds disponibles.

### Solution : Ajouter des Fonds de Test

Si vous souhaitez tester le transfer complet de l'application fee, vous pouvez ajouter des fonds de test au compte principal :

1. **Utiliser la carte de test spéciale** :
   - Carte : `4000000000000077`
   - Cette carte ajoute directement des fonds au solde disponible (sans créer de charge)
   - Utilisez cette carte dans votre interface de checkout pour ajouter des fonds

2. **Via le Dashboard Stripe** :
   - Allez dans votre Dashboard Stripe (mode test)
   - Section "Balance" → "Add funds"
   - Utilisez la carte de test `4000000000000077`

### En Production

En production, cette erreur ne devrait **jamais** se produire car :
- Les paiements réels ajoutent automatiquement des fonds au compte principal
- Le transfer de l'application fee se fera automatiquement après chaque paiement
- Le système gère cette erreur gracieusement et continue de fonctionner

### Gestion Automatique

Le système gère automatiquement cette erreur :
- L'erreur est capturée et loggée comme un warning (pas une erreur bloquante)
- L'application fee reste sur le compte principal jusqu'à ce que des fonds soient disponibles
- Le paiement et la commande sont créés avec succès
- Les remboursements fonctionnent correctement

### Vérification

Pour vérifier si le transfer a réussi :
1. Vérifiez les métadonnées du paiement dans la table `payments`
2. Si `application_fee_transfer_id` est présent → transfer réussi
3. Si `application_fee_transfer_error` est présent → transfer échoué (normal en mode test)

### Conclusion

**Vous n'avez rien à faire !** Le système fonctionne correctement même si cette erreur apparaît en mode test. En production, tout fonctionnera automatiquement.

