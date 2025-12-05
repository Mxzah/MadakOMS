#!/usr/bin/env node

/**
 * Script pour créer un compte Stripe Connect Express et ouvrir la page d'onboarding
 * 
 * Usage:
 *   node scripts/create-stripe-account.js [options]
 * 
 * Options:
 *   --email <email>          Email pour le compte Express
 *   --restaurant-slug <slug> Slug du restaurant à associer
 *   --country <code>         Code pays (défaut: CA)
 * 
 * Exemples:
 *   node scripts/create-stripe-account.js --email restaurant@example.com
 *   node scripts/create-stripe-account.js --email restaurant@example.com --restaurant-slug sante-taouk
 */

const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')
const { join } = require('path')
const { readFileSync, existsSync } = require('fs')
const { exec } = require('child_process')

// Charger les variables d'environnement depuis .env.local
const envPath = join(__dirname, '..', '.env.local')

if (existsSync(envPath)) {
  try {
    const envFile = readFileSync(envPath, 'utf-8')
    envFile.split('\n').forEach(line => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.trim()
          }
        }
      }
    })
  } catch (error) {
    console.warn('⚠️  Erreur lors du chargement de .env.local')
  }
}

// Vérifier les variables d'environnement requises
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ Erreur: STRIPE_SECRET_KEY n\'est pas défini')
  console.error('   Assurez-vous que la variable est définie dans .env.local')
  process.exit(1)
}

// Initialiser Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
})

// Initialiser Supabase (optionnel)
let supabase = null
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

// Fonction pour ouvrir l'URL dans le navigateur
function openBrowser(url) {
  const platform = process.platform
  let command

  if (platform === 'win32') {
    command = `start "" "${url}"`
  } else if (platform === 'darwin') {
    command = `open "${url}"`
  } else {
    command = `xdg-open "${url}"`
  }

  exec(command, (error) => {
    if (error) {
      console.error('❌ Impossible d\'ouvrir le navigateur automatiquement')
      console.log(`\n🔗 Ouvrez manuellement ce lien dans votre navigateur:`)
      console.log(url)
    } else {
      console.log('✅ Page d\'onboarding ouverte dans votre navigateur')
    }
  })
}

// Parser les arguments de ligne de commande
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    email: null,
    restaurantSlug: null,
    country: 'CA',
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      options.email = args[i + 1]
      i++
    } else if (args[i] === '--restaurant-slug' && args[i + 1]) {
      options.restaurantSlug = args[i + 1]
      i++
    } else if (args[i] === '--country' && args[i + 1]) {
      options.country = args[i + 1]
      i++
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node scripts/create-stripe-account.js [options]

Options:
  --email <email>              Email pour le compte Express
  --restaurant-slug <slug>      Slug du restaurant à associer
  --country <code>             Code pays (défaut: CA)
  --help, -h                   Afficher cette aide

Exemples:
  node scripts/create-stripe-account.js --email restaurant@example.com
  node scripts/create-stripe-account.js --email restaurant@example.com --restaurant-slug sante-taouk
      `)
      process.exit(0)
    }
  }

  return options
}

// Fonction principale
async function main() {
  const options = parseArgs()

  console.log('🚀 Création d\'un compte Stripe Connect Express...\n')

  try {
    // Préparer les paramètres du compte
    const accountParams = {
      type: 'express',
      country: options.country,
    }

    if (options.email) {
      accountParams.email = options.email
    }

    // Demander les capacités de paiement par carte
    accountParams.capabilities = {
      card_payments: { requested: true },
      transfers: { requested: true },
    }

    console.log('📝 Paramètres:')
    console.log(`   Type: ${accountParams.type}`)
    console.log(`   Pays: ${accountParams.country}`)
    if (accountParams.email) {
      console.log(`   Email: ${accountParams.email}`)
    }
    if (options.restaurantSlug) {
      console.log(`   Restaurant: ${options.restaurantSlug}`)
    }
    console.log('')

    // Créer le compte
    console.log('⏳ Création du compte...')
    const account = await stripe.accounts.create(accountParams)
    console.log(`✅ Compte créé: ${account.id}\n`)

    // Associer au restaurant si un slug est fourni
    if (options.restaurantSlug && supabase) {
      try {
        console.log(`🔗 Association au restaurant "${options.restaurantSlug}"...`)
        
        const { data: restaurant, error: restaurantError } = await supabase
          .from('restaurants')
          .select('id, name')
          .eq('slug', options.restaurantSlug)
          .maybeSingle()

        if (restaurantError) {
          console.error('❌ Erreur lors de la récupération du restaurant:', restaurantError.message)
        } else if (restaurant) {
          const { error: updateError } = await supabase
            .from('restaurant_settings')
            .upsert({
              restaurant_id: restaurant.id,
              stripe_account_id: account.id,
            }, {
              onConflict: 'restaurant_id',
            })

          if (updateError) {
            console.error('❌ Erreur lors de l\'association:', updateError.message)
          } else {
            console.log(`✅ Compte associé au restaurant "${restaurant.name}"\n`)
          }
        } else {
          console.warn(`⚠️  Restaurant "${options.restaurantSlug}" non trouvé\n`)
        }
      } catch (associationError) {
        console.error('❌ Erreur lors de l\'association:', associationError.message)
      }
    }

    // Créer le lien d'onboarding
    console.log('🔗 Création du lien d\'onboarding...')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${appUrl}/api/stripe/account-refresh?account_id=${account.id}`,
      return_url: `${appUrl}/api/stripe/account-return?account_id=${account.id}`,
      type: 'account_onboarding',
    })

    console.log('✅ Lien d\'onboarding créé\n')

    // Afficher les informations
    console.log('📊 Informations du compte:')
    console.log('─'.repeat(50))
    console.log(`ID du compte:     ${account.id}`)
    console.log(`Type:             ${account.type}`)
    console.log(`Pays:             ${account.country}`)
    console.log(`Email:            ${account.email || 'Non défini'}`)
    console.log('─'.repeat(50))
    console.log('')

    // Ouvrir le navigateur
    console.log('🌐 Ouverture de la page d\'onboarding...')
    openBrowser(link.url)
    
    console.log('\n📋 Instructions:')
    console.log('   1. Complétez les informations du compte dans la page qui s\'est ouverte')
    console.log('   2. Ajoutez un compte bancaire de test')
    console.log('   3. Acceptez les conditions d\'utilisation')
    console.log('   4. Une fois complété, le compte pourra recevoir des paiements')
    console.log('')

    // Afficher la commande SQL pour référence
    if (options.restaurantSlug && supabase) {
      console.log('💾 Pour mettre à jour manuellement dans la base de données:')
      console.log(`   UPDATE restaurant_settings`)
      console.log(`   SET stripe_account_id = '${account.id}'`)
      console.log(`   WHERE restaurant_id = (SELECT id FROM restaurants WHERE slug = '${options.restaurantSlug}');`)
      console.log('')
    }

    console.log('✅ Terminé!')
  } catch (error) {
    console.error('\n❌ Erreur lors de la création du compte:')
    console.error(`   Message: ${error.message}`)
    if (error.type) {
      console.error(`   Type: ${error.type}`)
    }
    if (error.code) {
      console.error(`   Code: ${error.code}`)
    }
    if (error.statusCode) {
      console.error(`   Status: ${error.statusCode}`)
    }
    process.exit(1)
  }
}

// Exécuter le script
main().catch(error => {
  console.error('\n❌ Erreur fatale:', error)
  process.exit(1)
})

