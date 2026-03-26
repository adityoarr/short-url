import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const slug = pathname.split('/').pop()

  // Filter agar tidak memproses file statis atau api
  if (!slug || pathname.includes('.') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/urls/${slug}?key=${apiKey}`

  try {
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      const targetUrl = data.fields?.original_url?.stringValue
      if (targetUrl) {
        return NextResponse.redirect(new URL(targetUrl))
      }
    }
  } catch (e) {
    console.error(e)
    return NextResponse.redirect(new URL("https://amartavecta.com/"))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match semua path kecuali yang dimulai dengan:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}