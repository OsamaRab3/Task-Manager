import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the path is protected
  const isProtectedPath =
    pathname !== "/auth/signin" &&
    !pathname.startsWith("/api/auth") &&
    !pathname.includes("_next") &&
    !pathname.includes("favicon.ico")

  if (isProtectedPath) {
    const token = await getToken({ req: request })

    // Redirect to login if not authenticated
    if (!token) {
      const url = new URL("/auth/signin", request.url)
      url.searchParams.set("callbackUrl", encodeURI(request.url))
      return NextResponse.redirect(url)
    }
  }

  // Redirect to home if already authenticated and trying to access auth pages
  if (pathname === "/auth/signin") {
    const token = await getToken({ req: request })
    if (token) {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
