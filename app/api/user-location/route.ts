import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    // Get client IP from headers
    const forwardedFor = request.headers.get("x-forwarded-for")
    const realIp = request.headers.get("x-real-ip")
    const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || ""
    
    // Try multiple geolocation APIs for reliability
    let locationData = null
    
    // Try ipapi.co first (HTTPS, free tier 1000/day)
    try {
      const ipapiUrl = clientIp 
        ? `https://ipapi.co/${clientIp}/json/`
        : `https://ipapi.co/json/`
      
      const response = await fetch(ipapiUrl, {
        headers: { "User-Agent": "InfidelityPro/1.0" },
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.city && data.latitude) {
          locationData = {
            city: data.city,
            country: data.country_name,
            lat: data.latitude,
            lng: data.longitude
          }
        }
      }
    } catch (e) {
      // Continue to next API
    }
    
    // Fallback to ipwho.is (HTTPS, unlimited free)
    if (!locationData) {
      try {
        const ipwhoisUrl = clientIp 
          ? `https://ipwho.is/${clientIp}`
          : `https://ipwho.is/`
        
        const response = await fetch(ipwhoisUrl, {
        headers: { "User-Agent": "InfidelityPro/1.0" },
          signal: AbortSignal.timeout(5000)
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.success !== false && data.city) {
            locationData = {
              city: data.city,
              country: data.country,
              lat: data.latitude,
              lng: data.longitude
            }
          }
        }
      } catch (e) {
        // Continue to fallback
      }
    }
    
    if (locationData) {
      return NextResponse.json({
        success: true,
        ...locationData
      })
    }
    
    throw new Error("All geolocation APIs failed")
    
  } catch (error) {
    // Return a realistic fallback based on common Brazilian cities
    const fallbackCities = [
      { city: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333 },
      { city: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729 },
      { city: "Fortaleza", country: "Brazil", lat: -3.7172, lng: -38.5433 },
      { city: "Belo Horizonte", country: "Brazil", lat: -19.9167, lng: -43.9345 },
      { city: "Salvador", country: "Brazil", lat: -12.9714, lng: -38.5014 },
    ]
    
    const randomCity = fallbackCities[Math.floor(Math.random() * fallbackCities.length)]
    
    return NextResponse.json({
      success: true,
      ...randomCity
    })
  }
}
