'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { initSocket, disconnectSocket } from '@/lib/socket'
import Header from '@/components/Header'
import ForcePasswordChange from '@/components/ForcePasswordChange'

export default function DashboardLayout({ children }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [socket, setSocket] = useState(null)

  // Initialize socket when authenticated
  useEffect(() => {
    if (status === 'authenticated' && session?.backendToken) {
      const socketInstance = initSocket(session.backendToken)
      setSocket(socketInstance)

      return () => {
        disconnectSocket()
      }
    }
  }, [status, session?.backendToken])

  // Handle force password change
  if (status === 'authenticated' && session?.mustChangePassword) {
    return <ForcePasswordChange />
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-brutal-bg flex items-center justify-center">
        <div className="font-mono text-neon-pink text-lg uppercase tracking-widest animate-pulse">
          Initializing Nexus...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brutal-bg">
      <Header socket={socket} />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
