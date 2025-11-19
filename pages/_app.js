import '../styles/globals.css'
import { ServiceProvider } from '../context/ServiceContext'
import { CartProvider } from '../context/CartContext'
import CartDrawer from '../components/CartDrawer'

export default function MyApp({ Component, pageProps }) {
  return (
    <ServiceProvider>
      <CartProvider>
        <Component {...pageProps} />
        <CartDrawer />
      </CartProvider>
    </ServiceProvider>
  )
}
