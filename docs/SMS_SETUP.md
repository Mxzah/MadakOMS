# Configuration SMS avec Twilio

Ce document explique comment configurer Twilio pour envoyer des notifications SMS aux clients lors des changements de statut de commande.

## Prérequis

1. Un compte Twilio (gratuit pour les tests) - [https://www.twilio.com](https://www.twilio.com)
2. Un numéro de téléphone Twilio (fourni lors de l'inscription)

## Étapes de configuration

### 1. Créer un compte Twilio

1. Allez sur [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Créez un compte gratuit (compte d'essai)
3. Vérifiez votre numéro de téléphone personnel (nécessaire pour recevoir le code de vérification)

### 2. Obtenir les identifiants Twilio

1. Connectez-vous à votre [Console Twilio](https://console.twilio.com)
2. Allez dans **Account** > **API keys & tokens**
3. Copiez les informations suivantes :
   - **Account SID** (commence par `AC...`)
   - **Auth Token** (cliquez sur "View" pour le révéler)
4. Allez dans **Phone Numbers** > **Manage** > **Active numbers**
5. Copiez votre **Phone Number** (format: `+1XXXXXXXXXX`)

### 3. Configurer les variables d'environnement

Ajoutez les identifiants Twilio à votre fichier `.env.local` :

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

**Important :**
- `TWILIO_ACCOUNT_SID` et `TWILIO_AUTH_TOKEN` doivent rester secrets (ne pas les exposer au client)
- `TWILIO_PHONE_NUMBER` doit être au format E.164 (ex: `+14155552671`)

### 4. Installer la dépendance Twilio

```bash
npm install twilio
```

### 5. Redémarrer le serveur de développement

Après avoir ajouté les variables d'environnement, redémarrez votre serveur Next.js :

```bash
npm run dev
```

## Notifications SMS envoyées

### Pour les commandes de livraison

1. **Commande approuvée** (statut: `preparing`)
   - Envoyé quand la commande passe de `received` à `preparing`
   - Message: "Bonjour [nom], votre commande #[numéro] a été approuvée et est en préparation. [restaurant] vous contactera bientôt."

2. **Livreur en route** (statut: `enroute`)
   - Envoyé quand la commande passe de `ready` à `enroute`
   - Message: "Votre commande #[numéro] est prête. Le livreur va la chercher au restaurant et sera bientôt en route vers vous."

3. **Livreur proche** (détection de proximité)
   - Envoyé automatiquement quand le livreur est à moins de 500 mètres de l'adresse de livraison
   - Vérifié toutes les 30 secondes quand le statut est `enroute`
   - Message: "Votre livreur est proche de votre adresse. Votre commande #[numéro] de [restaurant] arrivera bientôt!"
   - **Note:** Un seul SMS est envoyé par commande (évite les doublons)

### Pour les commandes de cueillette

1. **Commande approuvée** (statut: `preparing`)
   - Envoyé quand la commande passe de `received` à `preparing`
   - Message: "Bonjour, votre commande #[numéro] a été approuvée et est en préparation chez [restaurant]."

2. **Commande prête** (statut: `ready`)
   - Envoyé quand la commande passe de `preparing` à `ready`
   - Message: "Votre commande #[numéro] est prête à être récupérée chez [restaurant]. Vous pouvez venir la chercher."

## Format des numéros de téléphone

Les numéros de téléphone sont automatiquement formatés en format E.164 (requis par Twilio) :
- Numéros à 10 chiffres (Amérique du Nord) : `+1` est ajouté automatiquement
- Numéros à 11 chiffres commençant par `1` : `+` est ajouté automatiquement
- Numéros déjà au format E.164 (commençant par `+`) : utilisés tels quels

## Test des notifications SMS

### Compte d'essai Twilio

Avec un compte d'essai Twilio, vous pouvez envoyer des SMS uniquement vers les numéros de téléphone vérifiés dans votre compte Twilio.

Pour tester :
1. Allez dans **Phone Numbers** > **Verified Caller IDs**
2. Ajoutez votre numéro de téléphone personnel
3. Testez en créant une commande avec ce numéro

### Compte payant Twilio

Avec un compte payant, vous pouvez envoyer des SMS vers n'importe quel numéro de téléphone valide.

## API Routes

### `/api/sms/send`
Route générique pour envoyer un SMS.

**POST** `/api/sms/send`
```json
{
  "to": "+14155552671",
  "message": "Votre message ici"
}
```

### `/api/orders/[id]/check-driver-proximity`
Vérifie si le livreur est proche de l'adresse de livraison et envoie un SMS si c'est le cas.

**POST** `/api/orders/[id]/check-driver-proximity`

Cette route est appelée automatiquement toutes les 30 secondes par la page de tracking des commandes quand :
- Le statut de la commande est `enroute`
- Le type de service est `delivery`
- Un livreur est assigné
- La position du livreur et l'adresse de livraison sont disponibles

## Test de la configuration

### Tester l'envoi de SMS

Utilisez l'API de test pour vérifier que Twilio est correctement configuré :

**POST** `/api/sms/test`
```json
{
  "to": "+14155552671"
}
```

Cette route vous indiquera :
- Si les variables d'environnement sont configurées
- Si le numéro de téléphone est au bon format
- Si l'envoi a réussi ou échoué
- Les détails de l'erreur en cas d'échec

**Exemple avec curl :**
```bash
curl -X POST http://localhost:3000/api/sms/test \
  -H "Content-Type: application/json" \
  -d '{"to": "+14155552671"}'
```

## Dépannage

### "SMS service not configured"
1. Vérifiez que toutes les variables d'environnement Twilio sont définies dans `.env.local`
2. **Redémarrez le serveur Next.js** après avoir ajouté les variables d'environnement
3. Utilisez `/api/sms/test` pour vérifier la configuration

### "Phone number or message missing"
Vérifiez que le numéro de téléphone du client est bien enregistré dans la commande.

### "Format de numéro de téléphone invalide"
Le numéro de téléphone fourni ne peut pas être formaté en E.164. Vérifiez le format du numéro dans la base de données.

### SMS non reçu

**1. Vérifiez la configuration avec l'API de test**
```bash
POST /api/sms/test
```

**2. Vérifiez les logs du serveur**
- Ouvrez la console du serveur Next.js
- Cherchez les messages `[SMS]` pour voir les erreurs détaillées

**3. Compte d'essai Twilio**
Si vous utilisez un compte d'essai Twilio, vous ne pouvez envoyer des SMS qu'aux numéros vérifiés :
- Allez dans **Twilio Console** > **Phone Numbers** > **Verified Caller IDs**
- Ajoutez votre numéro de téléphone personnel
- Testez avec ce numéro uniquement

**4. Vérifiez que les SMS sont déclenchés**
Les SMS sont envoyés automatiquement lors des transitions de statut :
- Pour tester, créez une commande et approuvez-la (statut passe de `received` à `preparing`)
- Vérifiez que le numéro de téléphone est bien enregistré dans la commande

**5. Vérifiez le format du numéro Twilio**
Le numéro Twilio dans `.env.local` doit être au format E.164 :
- ✅ Correct : `+15878415467` ou `+1 587 841 5467`
- ❌ Incorrect : `5878415467` ou `(587) 841-5467`

## Coûts

- **Compte d'essai** : Gratuit, mais limité aux numéros vérifiés
- **Compte payant** : Environ $0.0075 USD par SMS au Canada (prix variable selon le pays)

Pour plus d'informations, consultez la [documentation Twilio](https://www.twilio.com/docs/sms).

