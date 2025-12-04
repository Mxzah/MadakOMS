# Analyse des Migrations SQL

## Migrations ACTIVES (à garder) ✅

### 1. `migration_refund_on_cancel_trigger_v2.sql` - ✅ NÉCESSAIRE
**Raison :** Crée le trigger SQL qui insère des événements `refund_required` dans `order_events` quand une commande est annulée. Ce trigger est utilisé par le cron job `process-refund-events.js`.

**Action :** GARDER

---

### 2. `migration_payments_metadata.sql` - ✅ NÉCESSAIRE
**Raison :** Ajoute la colonne `metadata` à la table `payments`. Cette colonne est utilisée pour stocker les informations de transfer Stripe Connect (`transfer_id`, `application_fee_transfer_id`, etc.).

**Action :** GARDER (même si déjà exécutée, utile pour référence)

---

### 3. `migration_payment_check_trigger.sql` - ⚠️ UTILE
**Raison :** Vérifie que le paiement est confirmé avant de passer à "preparing". Annule automatiquement la commande si le paiement n'est pas confirmé.

**Action :** GARDER (sécurité importante)

---

## Migrations OBSOLÈTES (à supprimer) ❌

### 4. `migration_refund_on_cancel_trigger.sql` - ❌ ANCIENNE VERSION
**Raison :** Ancienne version remplacée par `migration_refund_on_cancel_trigger_v2.sql`

**Action :** SUPPRIMER

---

### 5. `migration_sms_notifications_trigger.sql` - ❌ NON UTILISÉ
**Raison :** Crée des événements `status_changed_sms_trigger` mais le cron job `process-sms-events.js` a été supprimé. Les SMS sont maintenant gérés par `advanceOrderStatus` et `order-status-change.js`.

**Action :** SUPPRIMER

---

## Migrations SCHEMA (déjà appliquées) 📋

Ces migrations modifient le schéma de la base de données. Une fois exécutées, elles sont appliquées à la DB. Vous pouvez les supprimer si vous êtes sûr qu'elles ont été exécutées :

- `migration_apartment_suite.sql` - Ajoute colonne `apartment_suite`
- `migration_drop_option.sql` - Modifie le schéma
- `migration_delivery_alternatives.sql` - Modifie le schéma
- `migration_payment_options.sql` - Modifie le schéma
- `migration_stripe_connect.sql` - Structure Stripe Connect

**Action :** Vous pouvez les supprimer si elles ont été exécutées, mais il est recommandé de les garder pour documentation.

---

## Recommandation

**À supprimer :**
- ❌ `migration_refund_on_cancel_trigger.sql` (ancienne version)
- ❌ `migration_sms_notifications_trigger.sql` (non utilisé)

**À garder :**
- ✅ `migration_refund_on_cancel_trigger_v2.sql` (actif)
- ✅ `migration_payments_metadata.sql` (actif)
- ✅ `migration_payment_check_trigger.sql` (sécurité)
- ⚠️ Migrations schema (garder pour documentation ou supprimer si déjà appliquées)

