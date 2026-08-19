import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get("url")

    if (!imageUrl) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 })
    }

    const parsedImageUrl = new URL(imageUrl)
    const isWhatsAppImage = parsedImageUrl.hostname.endsWith("whatsapp.net")
    const sourceName = isWhatsAppImage ? "WhatsApp" : "Instagram"

    console.log(`[v0] Proxying ${sourceName} image:`, imageUrl.substring(0, 100) + "...")

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      // Fetch the image from the source CDN with timeout
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          ...(isWhatsAppImage
            ? { Referer: "https://web.whatsapp.com/" }
            : { Referer: "https://www.instagram.com/" }),
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error(`[v0] Failed to fetch ${sourceName} image:`, response.status, response.statusText)
        return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status })
      }

      const imageBuffer = await response.arrayBuffer()
      const contentType = response.headers.get("content-type") || "image/jpeg"

      console.log(`[v0] Successfully proxied ${sourceName} image, size:`, imageBuffer.byteLength, "bytes")

      // Return the image with proper headers
      return new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400, immutable", // Cache for 24 hours
          "Access-Control-Allow-Origin": "*",
        },
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      if (fetchError.name === "AbortError") {
        console.error(`[v0] ${sourceName} image fetch timeout`)
        return NextResponse.json({ error: "Request timeout" }, { status: 504 })
      }
      throw fetchError
    }
  } catch (error: any) {
    console.error("[v0] Error proxying Instagram image:", error.message || error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
