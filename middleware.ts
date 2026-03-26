import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server'; // Import tipe data di sini

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Mengambil slug (misal: /promo -> promo)
  const slug = pathname.split('/').pop();

  // Proteksi: Abaikan jika slug kosong, ada titik (file), atau folder api
  if (!slug || pathname.includes('.') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  // URL REST API Firestore
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/links/${slug}?key=${apiKey}`;

  try {
    const response = await fetch(firestoreUrl);
    
    if (response.ok) {
      const data = await response.json();
      // Format response Firestore REST API: data.fields.url.stringValue
      const targetUrl = data.fields?.url?.stringValue;

      if (targetUrl) {
        // Gunakan 307 (Temporary Redirect) atau 308 (Permanent Redirect)
        return NextResponse.redirect(new URL(targetUrl));
      }
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }

  // Jika tidak ada di database, biarkan user lanjut ke halaman utama/404
  return NextResponse.next();
}

// Konfigurasi agar middleware hanya berjalan pada path utama, bukan asset statis
export const config = {
  matcher: '/:path*',
};