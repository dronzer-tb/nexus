import { Providers } from './providers'
import './globals.css'

export const metadata = {
  title: 'Nexus - System Monitor',
  description: 'Unified, self-hosted remote resource monitoring and management platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
