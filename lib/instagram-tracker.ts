export async function fetchInstagramProfile(username: string): Promise<{
  success: boolean
  profile?: any
  error?: string
}> {
  try {
    // Remove @ if present
    const cleanUsername = username.replace("@", "").trim()

    // Basic validation: Instagram usernames are 1-30 characters, alphanumeric + dots and underscores
    const usernameRegex = /^[a-zA-Z0-9._]{1,30}$/

    if (!usernameRegex.test(cleanUsername)) {
      return {
        success: false,
        error: "Invalid Instagram username format",
      }
    }

    console.log("[v0] Fetching Instagram profile for:", cleanUsername)

    // Call the API to fetch real Instagram data
    const response = await fetch("/api/instagram-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: cleanUsername,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error("[v0] Failed to fetch Instagram profile:", data.error)
      return {
        success: false,
        error: data.error || "Failed to fetch Instagram profile",
      }
    }

    console.log("[v0] Instagram profile fetched successfully:", data.profile)

    return {
      success: true,
      profile: data.profile,
    }
  } catch (error) {
    console.error("[v0] Error fetching Instagram profile:", error)
    return {
      success: false,
      error: "Failed to fetch Instagram profile",
    }
  }
}

export async function fetchInstagramPosts(username: string): Promise<{
  success: boolean
  posts?: any[]
  error?: string
}> {
  try {
    // Remove @ if present
    const cleanUsername = username.replace("@", "").trim()

    // Basic validation: Instagram usernames are 1-30 characters, alphanumeric + dots and underscores
    const usernameRegex = /^[a-zA-Z0-9._]{1,30}$/

    if (!usernameRegex.test(cleanUsername)) {
      return {
        success: false,
        error: "Invalid Instagram username format",
      }
    }

    console.log("[v0] Fetching Instagram posts for:", cleanUsername)

    // Call the API to fetch Instagram posts
    const response = await fetch("/api/instagram-posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: cleanUsername,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      if (data.error?.includes("private")) {
        console.log("[v0] Profile is private, posts not available")
      } else {
        console.error("[v0] Failed to fetch Instagram posts:", data.error)
      }
      return {
        success: false,
        error: data.error || "Failed to fetch Instagram posts",
      }
    }

    console.log("[v0] Instagram posts fetched successfully:", data.posts)

    return {
      success: true,
      posts: data.posts || [],
    }
  } catch (error) {
    console.error("[v0] Error fetching Instagram posts:", error)
    return {
      success: false,
      error: "Failed to fetch Instagram posts",
    }
  }
}
