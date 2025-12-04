# Analyse : Fichiers Cron et Webhooks - Ce qui est nécessaire

## Fichiers à GARDER ✅

### 1. `vercel.json` - ✅ NÉCESSAIRE
**Raison :** Configure le cron job Vercel pour traiter les remboursements automatiquement toutes les 5 minutes.

### 2. `pages/api/cron/process-refund-events.js` - ✅ NÉCESSAIRE
**Raison :** 
- Traite les événements `refund_required` créés par le trigger SQL
- C'est le mécanisme principal pour les remboursements automatiques
- Fonctionne même si le statut est changé depuis l'application mobile

---

## Fichiers à SIMPLIFIER ⚠️

### 3. `pages/api/webhooks/order-status-change.js` - ⚠️ PARTIELLEMENT NÉCESSAIRE
**Utilisé pour :**
- ✅ Envoi de SMS lors des changements de statut
- ❌ Remboursement (lignes 27-37) - **REDONDANT** car le cron job s'en charge déjà

**Action recommandée :** Retirer la partie remboursement (lignes 27-37), garder seulement la partie SMS.

---

## Fichiers à SUPPRIMER ❌

### 4. `pages/api/cron/process-sms-events.js` - ❌ REDONDANT
**Raison :**
- Les SMS sont déjà gérés par `advanceOrderStatus` (dans `lib/db/orders.js`)
- Les SMS sont aussi gérés par `order-status-change.js`
- Ce cron job semble être une solution alternative qui n'est plus utilisée

### 5. `pages/api/webhooks/supabase-order-events.js` - ❌ REDONDANT
**Raison :**
- Semble être un webhook alternatif pour traiter les événements Supabase
- Redondant avec `order-status-change.js`
- Pas référencé dans le code

---

## Résumé

**À garder :**
- ✅ `vercel.json`
- ✅ `pages/api/cron/process-refund-events.js`
- ✅ `pages/api/webhooks/order-status-change.js` (simplifié - retirer la partie remboursement)

**À supprimer :**
- ❌ `pages/api/cron/process-sms-events.js`
- ❌ `pages/api/webhooks/supabase-order-events.js`

**À simplifier :**
- ⚠️ `pages/api/webhooks/order-status-change.js` (retirer lignes 27-37)

