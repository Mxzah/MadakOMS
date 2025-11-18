import '../styles/globals.css'
import { ServiceProvider } from '../context/ServiceContext'

export default function MyApp({ Component, pageProps }) {
  return (
    <ServiceProvider>
      <Component {...pageProps} />
    </ServiceProvider>
  )
}
