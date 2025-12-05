# Intégration API de Remboursement Stripe - Application Mobile

## Contexte

Lorsque l'application mobile change le statut d'une commande à `cancelled`, elle doit également appeler l'API de remboursement Stripe pour rembourser automatiquement le client.

## API à appeler

### Endpoint

```
POST /api/stripe/cancel-payment
Content-Type: application/json
```

### Body

```json
{
  "orderId": "uuid-de-la-commande"
}
```

### URLs selon l'environnement

**Développement local (avec ngrok) :**
```
https://votre-tunnel-ngrok.ngrok.io/api/stripe/cancel-payment
```

**Développement local (IP locale) :**
```
http://192.168.1.XXX:3000/api/stripe/cancel-payment
```
*Remplacez `192.168.1.XXX` par l'IP locale de l'ordinateur de développement*

**Production :**
```
https://votre-domaine.com/api/stripe/cancel-payment
```

## Réponses de l'API

### Succès - Remboursement effectué (200)

```json
{
  "success": true,
  "action": "refunded",
  "refundId": "re_xxxxx",
  "status": "succeeded",
  "amount": 100.00,
  "totalRefunded": 100.00,
  "reverseTransfer": true
}
```

### Succès - Déjà remboursé (200)

```json
{
  "success": true,
  "action": "already_refunded",
  "refundId": "re_xxxxx",
  "status": "succeeded",
  "amount": 100.00
}
```

### Succès - Paiement annulé (200)

```json
{
  "success": true,
  "action": "cancelled",
  "paymentIntentId": "pi_xxxxx",
  "status": "canceled"
}
```

### Erreur - Commande introuvable (404)

```json
{
  "error": "Paiement Stripe introuvable pour cette commande"
}
```

### Erreur - Erreur serveur (500)

```json
{
  "error": "Impossible d'annuler/rembourser le paiement",
  "details": "Message d'erreur détaillé"
}
```

## Implémentation recommandée

### 1. Après la mise à jour du statut

Appelez l'API **après** avoir mis à jour le statut de la commande à `cancelled` dans la base de données :

```dart
// Exemple Flutter
void onCancelOrder(String orderId) async {
  try {
    // 1. Mettre à jour le statut dans la base de données
    await updateOrderStatus(orderId, 'cancelled');
    
    // 2. Appeler l'API de remboursement
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/stripe/cancel-payment'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'orderId': orderId}),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      if (data['success'] == true) {
        print('Remboursement effectué: ${data['refundId']}');
        // Optionnel: Afficher une notification de succès
      }
    } else {
      final error = jsonDecode(response.body);
      print('Erreur remboursement: ${error['error']}');
      // Optionnel: Logger l'erreur ou afficher un avertissement
    }
  } catch (e) {
    print('Erreur lors du remboursement: $e');
    // Ne pas bloquer l'interface - le remboursement peut être fait manuellement
  }
}
```

### 2. Gestion des erreurs

- **Ne pas bloquer l'interface utilisateur** si l'appel échoue
- Logger les erreurs pour le débogage
- Optionnel: Afficher un avertissement à l'utilisateur si le remboursement échoue
- Le remboursement peut toujours être fait manuellement depuis le Dashboard Stripe si nécessaire

### 3. Idempotence

L'API vérifie automatiquement si un remboursement existe déjà. Vous pouvez appeler l'API plusieurs fois sans risque de double remboursement.

## Configuration de l'URL de base

### Variable d'environnement recommandée

Créez une variable d'environnement pour l'URL de base de l'API :

**Développement :**
```dart
const String apiBaseUrl = 'https://votre-tunnel-ngrok.ngrok.io';
// ou
const String apiBaseUrl = 'http://192.168.1.XXX:3000';
```

**Production :**
```dart
const String apiBaseUrl = 'https://votre-domaine.com';
```

### Utilisation de ngrok pour les tests locaux

1. Installer ngrok : https://ngrok.com/download
2. Démarrer votre serveur Next.js : `npm run dev`
3. Dans un autre terminal : `ngrok http 3000`
4. Utiliser l'URL HTTPS fournie par ngrok (ex: `https://abc123.ngrok.io`)

**Note :** L'URL ngrok change à chaque redémarrage (gratuit). Pour une URL fixe, utilisez un compte ngrok payant.

## Notes importantes

1. **L'API doit être appelée même si le remboursement a déjà été effectué** - elle vérifie automatiquement et retourne `already_refunded` si c'est le cas.

2. **L'API gère automatiquement les Application Fees** - si le paiement utilisait Stripe Connect avec Application Fees, le remboursement reverse automatiquement les transfers.

3. **Pas de double remboursement** - L'API vérifie les remboursements existants avant d'en créer un nouveau.

4. **Environnement local** - Pour tester en local, utilisez ngrok ou l'IP locale de l'ordinateur de développement.

## Test

Pour tester l'API manuellement :

```bash
curl -X POST http://localhost:3000/api/stripe/cancel-payment \
  -H "Content-Type: application/json" \
  -d '{"orderId": "uuid-de-la-commande"}'
```

