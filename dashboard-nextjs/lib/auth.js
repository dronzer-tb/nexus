import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const authOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        totpToken: { label: "2FA Code", type: "text", optional: true },
        recoveryCode: { label: "Recovery Code", type: "text", optional: true }
      },
      async authorize(credentials) {
        try {
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080'
          
          // Call Express backend login endpoint
          const response = await fetch(`${backendUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password,
              totpToken: credentials.totpToken || undefined,
              recoveryCode: credentials.recoveryCode || undefined,
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            // Handle 2FA requirement
            if (response.status === 403 && data.requires2FA) {
              throw new Error(JSON.stringify({ 
                message: data.message || 'Two-factor authentication required',
                requires2FA: true 
              }))
            }
            throw new Error(data.message || data.error || 'Invalid credentials')
          }

          if (data.token && data.user) {
            // Return user object with backend token
            return {
              id: data.user.id?.toString() || data.user.username,
              username: data.user.username,
              role: data.user.role,
              backendToken: data.token,
              mustChangePassword: data.mustChangePassword || false,
            }
          }

          return null
        } catch (error) {
          console.error('Auth error:', error)
          throw error
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.username = user.username
        token.role = user.role
        token.backendToken = user.backendToken
        token.mustChangePassword = user.mustChangePassword
      }

      // Handle session updates (e.g., after password change)
      if (trigger === 'update' && session) {
        if (session.mustChangePassword !== undefined) {
          token.mustChangePassword = session.mustChangePassword
        }
      }

      return token
    },
    async session({ session, token }) {
      // Add custom properties to session
      if (token) {
        session.user.username = token.username
        session.user.role = token.role
        session.backendToken = token.backendToken
        session.mustChangePassword = token.mustChangePassword
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NEXTAUTH_DEBUG === 'true',
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
