#!/usr/bin/env node

/**
 * Script pour trouver automatiquement l'IP locale de l'ordinateur
 * Utile pour configurer l'URL de l'API dans l'application mobile
 */

const { networkInterfaces } = require('os')

const nets = networkInterfaces()
const results = {}

// Parcourir toutes les interfaces réseau
for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    // Ignorer les adresses IPv6 et les adresses internes (localhost)
    if (net.family === 'IPv4' && !net.internal) {
      if (!results[name]) {
        results[name] = []
      }
      results[name].push(net.address)
    }
  }
}

// Afficher toutes les IPs trouvées
console.log('\n🌐 Adresses IP locales disponibles :\n')
console.log('─'.repeat(50))

let found = false
for (const [interfaceName, ips] of Object.entries(results)) {
  for (const ip of ips) {
    console.log(`Interface: ${interfaceName}`)
    console.log(`  IP: ${ip}`)
    console.log(`  URL API: http://${ip}:3000`)
    console.log('')
    found = true
  }
}

if (!found) {
  console.log('❌ Aucune IP locale trouvée')
  console.log('   Assurez-vous d\'être connecté à un réseau WiFi ou Ethernet\n')
} else {
  // Afficher la première IP (généralement la bonne)
  const firstIP = Object.values(results)[0]?.[0]
  if (firstIP) {
    console.log('─'.repeat(50))
    console.log(`\n✅ IP recommandée : ${firstIP}`)
    console.log(`📱 URL pour l'app mobile : http://${firstIP}:3000`)
    console.log(`\n💡 Configurez cette URL dans votre application mobile :`)
    console.log(`   const String apiBaseUrl = 'http://${firstIP}:3000';\n`)
  }
}

