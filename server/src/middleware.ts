import { NextResponse, type NextRequest } from "next/server";

/**
 * 대시보드는 Basic Auth로 잠금 (아이디 아무거나, 비밀번호 = DASHBOARD_PASSWORD).
 * /api/ingest 와 /api/cron 은 각자 토큰으로 인증하므로 제외.
 */
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice(6));
    const pass = decoded.slice(decoded.indexOf(":") + 1);
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("인증 필요", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="wedding-fund", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!api/ingest|api/cron|_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
