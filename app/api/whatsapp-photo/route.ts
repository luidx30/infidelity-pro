import { type NextRequest, NextResponse } from "next/server"

// The WhatsApp photo API is slow (can take 30s+), so allow the serverless
// function enough time to finish instead of being killed early in production.
export const maxDuration = 60

// Cache para armazenar resultados por 5 minutos
const cache = new Map<string, { result: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// Serve a foto atraves do nosso proxy para evitar bloqueio de hotlink/CORS
// do CDN do WhatsApp (pps.whatsapp.net) quando carregada no navegador.
function proxied(url: string): string {
  return `/api/instagram-image-proxy?url=${encodeURIComponent(url)}`
}

export async function POST(request: NextRequest) {
  try {
    const { phone, countryCode } = await request.json()

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    const cleanNumber = phone.replace(/\D/g, "")
    const cleanCountryCode = countryCode?.replace(/\D/g, "") || ""
    const fullPhone = cleanCountryCode + cleanNumber
    
    console.log("[v0] ========== WHATSAPP API ROUTE ==========")
    console.log("[v0] Phone received:", phone)
    console.log("[v0] Country code received:", countryCode)
    console.log("[v0] Full phone number:", fullPhone)

    // Verifica cache
    const cached = cache.get(fullPhone)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("[v0] Returning cached WhatsApp photo")
      return NextResponse.json(
        {
          success: true,
          result: proxied(cached.result),
          is_photo_private: false,
        },
        {
          status: 200,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    // Tenta buscar da API RapidAPI. A chave nunca deve ficar no código-fonte.
    const apiUrl = "https://whatsapp-profile-data1.p.rapidapi.com/WhatsappProfilePhotoWithToken"
    const rapidApiKey = process.env.RAPIDAPI_KEY || process.env.X_RAPIDAPI_KEY

    if (!rapidApiKey) {
      console.error("[v0] RAPIDAPI_KEY is not configured")
      return NextResponse.json(
        { success: false, result: null, error: "WhatsApp API is not configured" },
        { status: 503, headers: { "Access-Control-Allow-Origin": "*" } },
      )
    }

    let photoUrl: string | null = null
    let apiError: { status: number; message: string } | null = null

    // Falhas de assinatura ou limite devem retornar imediatamente, sem esperar o timeout.
    try {
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(6000),
        method: "POST",
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": "whatsapp-profile-data1.p.rapidapi.com",
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        // A chamada Clojure enviada usa :form-params; a API espera form-urlencoded,
        // não JSON. Essa diferença fazia a RapidAPI ignorar o telefone.
        body: new URLSearchParams({ phone_number: fullPhone }).toString(),
        cache: "no-store",
      })

      const responseText = await response.text()
      console.log("[v0] RapidAPI response status:", response.status)

      if (!response.ok) {
        console.error("[v0] RapidAPI rejected request:", response.status, responseText.slice(0, 300))
        let providerMessage = "WhatsApp photo unavailable"
        try {
          providerMessage = JSON.parse(responseText)?.message || providerMessage
        } catch {
          // Mantém mensagem genérica quando o provedor não retorna JSON.
        }
        apiError = { status: response.status, message: providerMessage }
      } else {
        try {
          const jsonResponse = JSON.parse(responseText)
          const candidate =
            jsonResponse.url ||
            jsonResponse.urlImage ||
            jsonResponse.pictureUrl ||
            jsonResponse.profile_pic ||
            jsonResponse.profilePic ||
            jsonResponse.picture ||
            jsonResponse.photo ||
            (typeof jsonResponse.result === "string" ? jsonResponse.result : null)
          photoUrl = typeof candidate === "string" ? candidate.trim() : null
        } catch {
          console.error("[v0] RapidAPI returned invalid JSON:", responseText.slice(0, 300))
        }
      }
    } catch (fetchError) {
      console.error("[v0] RapidAPI fetch error:", fetchError)
    }

    // Diferencia assinatura/limite da ausência de foto para o usuário não ficar esperando.
    if (apiError) {
      const status = apiError.status === 403 ? 502 : apiError.status === 429 ? 429 : 502
      const error = apiError.status === 403
        ? "RapidAPI subscription is inactive for this API"
        : apiError.status === 429
          ? "RapidAPI rate limit reached"
          : apiError.message
      return NextResponse.json(
        { success: false, result: null, error },
        { status, headers: { "Access-Control-Allow-Origin": "*" } },
      )
    }

    // Nunca inventa um avatar: sem URL real, informa que a foto não foi encontrada.
    if (!photoUrl || !(photoUrl.startsWith("http://") || photoUrl.startsWith("https://"))) {
      return NextResponse.json(
        { success: false, result: null, error: "WhatsApp photo not found" },
        { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
      )
    }

    // Armazena no cache
    cache.set(fullPhone, {
      result: photoUrl.trim(),
      timestamp: Date.now(),
    })

    // Limita o tamanho do cache
    if (cache.size > 100) {
      const oldestKey = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]
      cache.delete(oldestKey)
    }

    // Retorna a URL da foto de perfil (via proxy para carregar no navegador)
    return NextResponse.json(
      {
        success: true,
        result: proxied(photoUrl.trim()),
        is_photo_private: false,
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    )
  } catch (error) {
    console.error("[v0] Erro na requisição:", error)
    return NextResponse.json(
      { success: false, result: null, error: "WhatsApp photo unavailable" },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
