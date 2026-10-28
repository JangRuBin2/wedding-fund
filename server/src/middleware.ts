import { NextResponse, type NextRequest } from "next/server";

/**
 * 대시보드는 Basic Auth로 잠금 (아이디 아무거나, 비밀번호 = DASHBOARD_PASSWORD).
 * /api/ingest, /api/tips, /api/cron 은 각자 토큰으로 인증하므로 제외.
 */
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      // 한글 비밀번호도 되게 UTF-8로 디코딩
      const bytes = Uint8Array.from(atob(auth.slice(6)), (c) => c.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      const pass = decoded.slice(decoded.indexOf(":") + 1);
      if (pass === password) return NextResponse.next();
    } catch {
      // 깨진 헤더는 그냥 다시 로그인 요청
    }
  }
  return new NextResponse("로그인이 필요해요", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="wedding-fund", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!api/ingest|api/cron|api/tips|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|heart.svg|photos/|icon-.*\\.png).*)"],
};
