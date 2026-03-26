import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const slug = pathname.split('/').pop()
  const FALLBACK_URL = 'https://amartavecta.com/'

  if (!slug || pathname === '/' || pathname.includes('.') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  
  // URL untuk GET data
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/urls/${slug}?key=${apiKey}`

  try {
    const res = await fetch(url)
    
    if (res.ok) {
      const data = await res.json()
      const targetUrl = data.fields?.original_url?.stringValue
      
      // Ambil nilai clicks saat ini (Firebase REST API mengembalikan string untuk integerValue)
      const currentClicks = parseInt(data.fields?.clicks?.integerValue || '0')

      if (targetUrl) {
        // --- PROSES UPDATE CLICKS (+1) ---
        // Kita gunakan updateMask agar hanya mengupdate field 'clicks'
        const updateUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/urls/${slug}?updateMask.fieldPaths=clicks&key=${apiKey}`
        
        // Kita gunakan fetch tanpa 'await' jika ingin redirect instan (fire and forget)
        // Atau gunakan 'await' jika ingin memastikan data masuk dulu
        fetch(updateUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              clicks: { integerValue: (currentClicks + 1).toString() }
            }
          })
        }).catch(err => console.error("Update clicks gagal:", err))
        // ---------------------------------

        return NextResponse.redirect(new URL(targetUrl))
      }
    }
    
    return NextResponse.redirect(new URL(FALLBACK_URL))
  } catch (e) {
    console.error('Middleware Error:', e)
    return NextResponse.redirect(new URL(FALLBACK_URL))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}