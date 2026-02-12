import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080'

async function proxyRequest(request, method, params) {
  try {
    const session = await auth()
    const path = params.path.join('/')
    const url = `${BACKEND_URL}/api/${path}`

    // Get request body for POST/PUT/PATCH
    let body = null
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        body = await request.json()
      } catch (e) {
        // No body or invalid JSON
      }
    }

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
    }

    // Add backend token if available
    if (session?.backendToken) {
      headers['Authorization'] = `Bearer ${session.backendToken}`
    }

    // Make request to backend
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request, { params }) {
  return proxyRequest(request, 'GET', params)
}

export async function POST(request, { params }) {
  return proxyRequest(request, 'POST', params)
}

export async function PUT(request, { params }) {
  return proxyRequest(request, 'PUT', params)
}

export async function PATCH(request, { params }) {
  return proxyRequest(request, 'PATCH', params)
}

export async function DELETE(request, { params }) {
  return proxyRequest(request, 'DELETE', params)
}
