import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const slug = pathname.split('/').pop()
  const FALLBACK_URL = 'https://amartavecta.com/'

  if (!slug || pathname === '/' || pathname.includes('.') || pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // 1. Identifikasi Pengunjung & Filter Bot
  const userAgent = request.headers.get('user-agent') || ''
  const isBot = /bot|spider|crawl|lighthouse|inspect|slurp|ia_archiver/i.test(userAgent)
  
  // Jika bot, langsung redirect tanpa catat apa-apa
  if (isBot) return NextResponse.redirect(new URL(FALLBACK_URL))

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const today = new Date().toISOString().split('T')[0]
  const device = /mobile/i.test(userAgent) ? 'mobile' : 'desktop'
  
  // Ambil IP (Antisipasi Localhost & Proxy)
  const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'

  try {
    // Ambil data awal untuk increment manual (karena REST API tidak punya increment() di Edge)
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/urls/${slug}?key=${apiKey}`
    const res = await fetch(url)
    if (!res.ok) return NextResponse.redirect(new URL(FALLBACK_URL))
    
    const data = await res.json()
    const targetUrl = data.fields?.original_url?.stringValue
    const currentTotal = parseInt(data.fields?.clicks?.integerValue || '0')

    if (targetUrl) {
      // --- BACKGROUND TASKS (Jangan pakai await agar redirect instan) ---

      // A. Update Counter Utama
      fetch(`${url}&updateMask.fieldPaths=clicks`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: { clicks: { integerValue: (currentTotal + 1).toString() } } })
      })

      // B. Update Daily Aggregation (Stats)
      // Kita asumsikan dashboard akan menghandle jika dokumen harian belum ada (atau pakai PATCH)
      const statsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/urls/${slug}/stats/${today}?key=${apiKey}&updateMask.fieldPaths=total&updateMask.fieldPaths=${device}`
      
      // Ambil data harian dulu untuk increment (atau bisa di-fetch paralel di atas)
      fetch(statsUrl).then(r => r.json()).then(sData => {
        const dTotal = parseInt(sData.fields?.total?.integerValue || '0')
        const dDevice = parseInt(sData.fields?.[device]?.integerValue || '0')
        
        fetch(statsUrl, {
          method: 'PATCH',
          body: JSON.stringify({
            fields: {
              total: { integerValue: (dTotal + 1).toString() },
              [device]: { integerValue: (dDevice + 1).toString() }
            }
          })
        })
      })

      // C. Simpan Catatan History Individual (Detailed Log)
      const logsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/urls/${slug}/logs?key=${apiKey}`
      fetch(logsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            ip: { stringValue: ip },
            location: { stringValue: `${request.geo?.city || 'Unknown'}, ${request.geo?.country || 'ID'}` },
            device: { stringValue: device },
            timestamp: { timestampValue: new Date().toISOString() }
          }
        })
      })

      return NextResponse.redirect(new URL(targetUrl))
    }
  } catch (e) {
    return NextResponse.redirect(new URL(FALLBACK_URL))
  }
}