import '../styles/globals.css'
import 'leaflet/dist/leaflet.css'
import { ServiceProvider } from '../context/ServiceContext'
import { CartProvider } from '../context/CartContext'
import CartDrawer from '../components/CartDrawer'
import GlobalLoadingOverlay from '../components/GlobalLoadingOverlay'
import Footer from '../components/Footer'

export default function MyApp({ Component, pageProps }) {
  return (
    <ServiceProvider>
      <CartProvider>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', maxWidth: '100%' }}>
          <Component {...pageProps} />
          <Footer />
        </div>
        <CartDrawer />
        <GlobalLoadingOverlay />
      </CartProvider>
    </ServiceProvider>
  )
}
