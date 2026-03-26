import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface ExtendedNextRequest extends NextRequest {
  ip?: string;
  geo?: {
    city?: string;
    country?: string;
    region?: string;
  };
}

export async function middleware(request: ExtendedNextRequest) {
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
      const statsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/urls/${slug}/stats/${today}?key=${apiKey}`;

      // 1. Ambil data stats hari ini
      const statsRes = await fetch(statsUrl);
      
      if (statsRes.status === 404) {
        // JIKA BELUM ADA: Buat dokumen baru (Initial State)
        fetch(statsUrl, {
          method: 'PATCH', // PATCH pada dokumen baru akan membuatnya (Create)
          body: JSON.stringify({
            fields: {
              total: { integerValue: "1" },
              [device]: { integerValue: "1" },
              last_update: { timestampValue: new Date().toISOString() }
            }
          })
        });
      } else {
        // JIKA SUDAH ADA: Update increment
        const sData = await statsRes.json();
        const dTotal = parseInt(sData.fields?.total?.integerValue || '0');
        const dDevice = parseInt(sData.fields?.[device]?.integerValue || '0');

        fetch(`${statsUrl}&updateMask.fieldPaths=total&updateMask.fieldPaths=${device}`, {
          method: 'PATCH',
          body: JSON.stringify({
            fields: {
              total: { integerValue: (dTotal + 1).toString() },
              [device]: { integerValue: (dDevice + 1).toString() }
            }
          })
        });
      }

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