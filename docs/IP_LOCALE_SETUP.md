# Configuration IP Locale pour les tests avec l'application mobile

## Vue d'ensemble

Cette méthode permet à votre application mobile d'accéder à votre API locale en utilisant l'IP locale de votre ordinateur au lieu de `localhost`.

**Avantages :**
- Simple et gratuit
- Pas besoin d'outils supplémentaires
- Pas de limite de temps

**Limitations :**
- L'appareil mobile et l'ordinateur doivent être sur le **même réseau WiFi**
- L'IP peut changer si vous vous reconnectez au WiFi

## Étape 1 : Trouver votre IP locale

### Sur Windows

1. **Ouvrez PowerShell ou CMD**

2. **Exécutez la commande :**
   ```powershell
   ipconfig
   ```

3. **Cherchez "IPv4 Address"** dans la section de votre connexion WiFi (ou Ethernet)

   Exemple de sortie :
   ```
   Carte réseau sans fil Wi-Fi :

      Adresse IPv4. . . . . . . . . . . . . . .: 192.168.1.100
      Masque de sous-réseau . . . . . . . . . .: 255.255.255.0
      Passerelle par défaut. . . . . . . . . . .: 192.168.1.1
   ```

   Votre IP locale est : **192.168.1.100** (la vôtre sera différente)

### Alternative : Via l'interface Windows

1. Ouvrez **Paramètres Windows** (Win + I)
2. Allez dans **Réseau et Internet** > **Wi-Fi** (ou **Ethernet**)
3. Cliquez sur votre connexion réseau
4. Faites défiler jusqu'à **Propriétés**
5. Cherchez **Adresse IPv4** - c'est votre IP locale

## Étape 2 : Vérifier que le serveur Next.js est accessible

### 1. Démarrer le serveur Next.js

```bash
npm run dev
```

Le serveur devrait démarrer sur `http://localhost:3000`

### 2. Tester depuis votre navigateur

Ouvrez votre navigateur et allez sur :
```
http://VOTRE_IP_LOCALE:3000
```

Par exemple : `http://192.168.1.100:3000`

**Si la page s'affiche :** ✅ Votre serveur est accessible via l'IP locale

**Si la page ne s'affiche pas :** Vérifiez le firewall Windows (voir section Dépannage)

## Étape 3 : Configurer le firewall Windows

Par défaut, Windows peut bloquer les connexions entrantes. Vous devez autoriser le port 3000.

### Méthode 1 : Via PowerShell (Administrateur)

1. **Ouvrez PowerShell en tant qu'administrateur** (clic droit > Exécuter en tant qu'administrateur)

2. **Autorisez le port 3000 :**
   ```powershell
   New-NetFirewallRule -DisplayName "Next.js Dev Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```

### Méthode 2 : Via l'interface Windows

1. Ouvrez **Pare-feu Windows Defender** (recherchez "firewall" dans le menu Démarrer)
2. Cliquez sur **Paramètres avancés**
3. Cliquez sur **Règles de trafic entrant** > **Nouvelle règle**
4. Sélectionnez **Port** > **Suivant**
5. Sélectionnez **TCP** et entrez **3000** > **Suivant**
6. Sélectionnez **Autoriser la connexion** > **Suivant**
7. Cochez tous les profils (Domaine, Privé, Public) > **Suivant**
8. Nommez la règle "Next.js Dev Server" > **Terminer**

## Étape 4 : Configuration dans l'application mobile

### URL de base pour l'API

Dans votre application mobile, configurez l'URL de base :

**Développement (IP locale) :**
```dart
const String apiBaseUrl = 'http://192.168.1.100:3000';
```
*Remplacez `192.168.1.100` par votre IP locale*

**Production :**
```dart
const String apiBaseUrl = 'https://votre-domaine.com';
```

### Exemple d'appel API

```dart
final response = await http.post(
  Uri.parse('$apiBaseUrl/api/stripe/cancel-payment'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'orderId': orderId}),
);
```

## Étape 5 : Tester depuis l'application mobile

1. **Assurez-vous que :**
   - Votre ordinateur et votre appareil mobile sont sur le **même réseau WiFi**
   - Le serveur Next.js est démarré
   - Le firewall autorise le port 3000

2. **Depuis l'application mobile**, testez un appel API simple :
   ```dart
   // Test de connexion
   final response = await http.get(
     Uri.parse('http://192.168.1.100:3000/api/health'), // Créez cette route pour tester
   );
   ```

## Dépannage

### L'application mobile ne peut pas se connecter

**Vérification 1 : Même réseau WiFi**
- Vérifiez que votre ordinateur et votre appareil mobile sont sur le même réseau WiFi
- Évitez les réseaux "invités" ou isolés

**Vérification 2 : Firewall Windows**
- Vérifiez que le port 3000 est autorisé dans le firewall
- Essayez de désactiver temporairement le firewall pour tester

**Vérification 3 : IP correcte**
- Vérifiez que l'IP dans l'app mobile correspond à l'IP actuelle de votre ordinateur
- L'IP peut changer si vous vous reconnectez au WiFi

**Vérification 4 : Serveur démarré**
- Vérifiez que `npm run dev` est bien en cours d'exécution
- Testez `http://VOTRE_IP:3000` dans votre navigateur depuis votre ordinateur

**Vérification 5 : Port utilisé**
- Si le port 3000 est déjà utilisé, Next.js utilisera un autre port (ex: 3001)
- Vérifiez dans le terminal Next.js quel port est utilisé
- Mettez à jour l'URL dans l'app mobile en conséquence

### Tester la connexion depuis un autre appareil

**Depuis un autre ordinateur ou téléphone sur le même réseau :**

1. Ouvrez un navigateur
2. Allez sur `http://VOTRE_IP:3000`
3. Si la page s'affiche, la connexion fonctionne ✅

### L'IP change fréquemment

**Solution : Réserver une IP statique**

1. Ouvrez **Paramètres Windows** > **Réseau et Internet** > **Wi-Fi**
2. Cliquez sur votre connexion > **Propriétés**
3. Faites défiler jusqu'à **Paramètres IP** > **Modifier**
4. Sélectionnez **Manuel**
5. Entrez :
   - **Adresse IP** : Votre IP actuelle (ex: 192.168.1.100)
   - **Masque de sous-réseau** : 255.255.255.0
   - **Passerelle par défaut** : L'adresse de votre routeur (ex: 192.168.1.1)
   - **DNS préféré** : 8.8.8.8 (Google DNS)

**Note :** Assurez-vous que cette IP n'est pas déjà utilisée par un autre appareil.

## Workflow de développement

1. **Démarrer le serveur Next.js :**
   ```bash
   npm run dev
   ```

2. **Vérifier votre IP locale :**
   ```powershell
   ipconfig
   ```

3. **Tester depuis votre navigateur :**
   ```
   http://VOTRE_IP:3000
   ```

4. **Configurer l'URL dans l'application mobile :**
   ```dart
   const String apiBaseUrl = 'http://VOTRE_IP:3000';
   ```

5. **Tester depuis l'application mobile**

## Alternative : Script pour trouver l'IP automatiquement

Créez un fichier `scripts/get-local-ip.js` :

```javascript
const { networkInterfaces } = require('os');

const nets = networkInterfaces();
const results = {};

for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    // Ignorer les adresses IPv6 et les adresses internes
    if (net.family === 'IPv4' && !net.internal) {
      if (!results[name]) {
        results[name] = [];
      }
      results[name].push(net.address);
    }
  }
}

// Afficher la première IP trouvée
const firstIP = Object.values(results)[0]?.[0];
if (firstIP) {
  console.log(`\n🌐 Votre IP locale est : ${firstIP}`);
  console.log(`📱 URL pour l'app mobile : http://${firstIP}:3000\n`);
} else {
  console.log('❌ Aucune IP locale trouvée');
}
```

Exécutez :
```bash
node scripts/get-local-ip.js
```

