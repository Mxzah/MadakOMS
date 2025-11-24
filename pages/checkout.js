import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function LegacyCheckoutRedirect() {
  const router = useRouter()
  const [message, setMessage] = useState('Redirection vers la caisse…')
  const [navigatingHome, setNavigatingHome] = useState(false)

  useEffect(() => {
    if (!router.isReady) return
    router.replace('/').catch((error) => {
      console.error('Redirection vers l’accueil échouée', error)
      setMessage('Impossible de rediriger automatiquement. Veuillez retourner à l’accueil.')
    })
  }, [router])

  const handleReturnHome = () => {
    setNavigatingHome(true)
    router.push('/').catch((error) => {
      console.error('Home navigation failed', error)
      setNavigatingHome(false)
    })
  }

  return (
    <main style={{ padding: '24px', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', minHeight: '50vh' }}>
      <p>{message}</p>
      {message.includes('sélectionner') && (
        <button
          type="button"
          onClick={handleReturnHome}
          disabled={navigatingHome}
          style={{ marginTop: '12px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #d1d5db', cursor: 'pointer', opacity: navigatingHome ? 0.6 : 1 }}
        >
          Retourner à l'accueil
        </button>
      )}

      {navigatingHome && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.35)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            color: '#fff',
            fontSize: '18px',
            fontWeight: 600,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                border: '4px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                margin: '0 auto 12px auto',
                animation: 'spin 1s linear infinite',
              }}
            />
            Retour à l'accueil…
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/',
      permanent: false,
    },
  }
}
