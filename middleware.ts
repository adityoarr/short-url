import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const slug = pathname.split('/').pop()
  
  // URL Tujuan Utama (Landing Page)
  const FALLBACK_URL = 'https://amartavecta.com/'

  // 1. Jika slug kosong (mengakses s.amartavecta.com/)
  if (!slug || pathname === '/') {
    return NextResponse.redirect(new URL(FALLBACK_URL))
  }

  // 2. Filter agar tidak memproses file statis (favicon, images, dsb)
  if (pathname.includes('.') || pathname.startsWith('/api')) {
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
        // Berhasil menemukan link, redirect ke tujuan
        return NextResponse.redirect(new URL(targetUrl))
      }
    }
    
    // 3. Jika slug TIDAK terdaftar di database (res.ok adalah false)
    return NextResponse.redirect(new URL(FALLBACK_URL))

  } catch (e) {
    // 4. Jika terjadi error koneksi atau API, arahkan ke fallback agar user tidak stuck
    console.error('Middleware Error:', e)
    return NextResponse.redirect(new URL(FALLBACK_URL))
  }
}

export const config = {
  matcher: [
    /*
     * Jalankan middleware pada semua path kecuali file internal Next.js
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}