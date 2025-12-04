# Configuration du Cron Job pour les Remboursements Automatiques

## Vue d'ensemble

Le système de remboursement automatique fonctionne en 3 étapes :

1. **Trigger SQL** : Quand une commande passe à `cancelled`, un événement est inséré dans `order_events`
2. **Cron Job** : Toutes les 5 minutes, le cron job traite les événements `refund_required`
3. **API de remboursement** : Le cron job appelle `/api/stripe/cancel-payment` pour chaque événement

## Installation

### 1. Exécuter le trigger SQL

Exécutez le fichier `migration_refund_on_cancel_trigger_v2.sql` dans le SQL Editor de Supabase :

```sql
-- Le trigger sera créé automatiquement
```

### 2. Configurer le Cron Job

#### Option A : Vercel (Recommandé si vous déployez sur Vercel)

Le fichier `vercel.json` est déjà configuré pour exécuter le cron job toutes les 5 minutes.

**Aucune action supplémentaire nécessaire** - Vercel détectera automatiquement le fichier `vercel.json` et configurera le cron job.

#### Option B : Service externe (cron-job.org, EasyCron, etc.)

1. Créez un compte sur un service de cron externe
2. Configurez une tâche qui appelle :
   ```
   GET https://votre-domaine.com/api/cron/process-refund-events?secret=VOTRE_SECRET
   ```
3. Définissez la fréquence : toutes les 5 minutes (`*/5 * * * *`)
4. Ajoutez `CRON_SECRET` dans vos variables d'environnement

#### Option C : GitHub Actions (Gratuit)

Créez `.github/workflows/refund-cron.yml` :

```yaml
name: Process Refund Events

on:
  schedule:
    - cron: '*/5 * * * *'  # Toutes les 5 minutes
  workflow_dispatch:  # Permet de déclencher manuellement

jobs:
  process-refunds:
    runs-on: ubuntu-latest
    steps:
      - name: Call Refund API
        run: |
          curl -X GET "https://votre-domaine.com/api/cron/process-refund-events?secret=${{ secrets.CRON_SECRET }}"
```

#### Option D : Appel manuel pour test

Vous pouvez appeler l'API manuellement pour tester :

```bash
# Sans secret (si CRON_SECRET n'est pas défini)
curl http://localhost:3000/api/cron/process-refund-events

# Avec secret
curl "http://localhost:3000/api/cron/process-refund-events?secret=VOTRE_SECRET"
```

## Variables d'environnement

Ajoutez dans `.env.local` (optionnel, pour la sécurité) :

```env
CRON_SECRET=votre_secret_aleatoire_ici
```

## Vérification

### 1. Vérifier que le trigger fonctionne

1. Annulez une commande depuis l'application mobile
2. Vérifiez dans Supabase que l'événement a été créé :

```sql
SELECT * FROM order_events 
WHERE event_type = 'refund_required' 
ORDER BY created_at DESC 
LIMIT 5;
```

### 2. Vérifier que le cron job traite les événements

1. Attendez 5 minutes (ou appelez l'API manuellement)
2. Vérifiez les logs du serveur Next.js
3. Vérifiez que l'événement a été supprimé de `order_events` (traitement réussi)

### 3. Vérifier les logs

Les logs suivants devraient apparaître dans la console :

```
[Cron Refund] Traitement de X événement(s) de remboursement
[Cron Refund] Traitement du remboursement pour la commande xxx
[Cancel Payment] Transfer trouvé: ...
[Cancel Payment] Reversal créé avec succès: ...
```

## Dépannage

### Le cron job ne s'exécute pas

1. Vérifiez que `vercel.json` est présent à la racine du projet
2. Vérifiez que vous avez déployé sur Vercel
3. Vérifiez les logs Vercel dans le dashboard

### Les événements ne sont pas traités

1. Vérifiez que le trigger SQL est bien installé
2. Vérifiez que les événements sont créés dans `order_events`
3. Vérifiez les logs du cron job pour voir les erreurs

### Le remboursement échoue

1. Vérifiez les logs détaillés dans `/api/stripe/cancel-payment`
2. Vérifiez que le transfer existe dans `payment.metadata.transfer_id`
3. Vérifiez le solde du compte connecté dans Stripe

## Fréquence recommandée

- **Développement** : 5 minutes (`*/5 * * * *`)
- **Production** : 2-3 minutes (`*/2 * * * *` ou `*/3 * * * *`)

Vous pouvez modifier la fréquence dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/process-refund-events",
      "schedule": "*/2 * * * *"  // Toutes les 2 minutes
    }
  ]
}
```

