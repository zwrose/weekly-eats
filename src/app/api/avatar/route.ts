import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint for Google profile images to:
 * 1. Add proper caching headers
 * 2. Handle 429 rate limiting errors gracefully
 * 3. Reduce direct requests to Google's servers
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Validate that it's a Google image URL for security
  if (!imageUrl.startsWith('https://lh3.googleusercontent.com/')) {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
  }

  try {
    // Fetch the image with proper headers
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WeeklyEats/1.0)',
      },
      // Add a timeout to prevent hanging
      signal: AbortSignal.timeout(5000),
    });

    // Handle rate limiting
    if (response.status === 429) {
      // Return a 503 (Service Unavailable) with retry-after
      return new NextResponse(null, {
        status: 503,
        headers: {
          'Retry-After': '3600', // Retry after 1 hour
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        },
      });
    }

    if (!response.ok) {
      return new NextResponse(null, { status: response.status });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();

    // Return with aggressive caching to reduce requests
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        // Cache for 30 days, but allow stale content for 60 days
        'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=5184000, immutable',
        // Pass through ETag if available
        ...(response.headers.get('ETag') && {
          'ETag': response.headers.get('ETag')!,
        }),
      },
    });
  } catch (error) {
    console.error('Error fetching avatar image:', error);
    
    // Return 503 on timeout or network errors
    if (error instanceof Error && error.name === 'AbortError') {
      return new NextResponse(null, {
        status: 503,
        headers: {
          'Retry-After': '60',
          'Cache-Control': 'public, max-age=60',
        },
      });
    }

    return new NextResponse(null, { status: 500 });
  }
}

