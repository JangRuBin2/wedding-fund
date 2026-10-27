import "dotenv/config";
import { defineConfig } from "prisma/config";

// CLI(db push 등)는 커넥션 풀러를 거치지 않는 직접 주소가 안전해서 UNPOOLED가 있으면 그걸 씀.
// (Vercel의 Neon 연동이 DATABASE_URL / DATABASE_URL_UNPOOLED 를 둘 다 넣어줌)
// generate는 DB 주소가 필요 없어서, 비어 있어도 npm install 이 깨지지 않게 빈 문자열 허용.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
