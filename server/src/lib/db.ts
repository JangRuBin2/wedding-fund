import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// 서버리스에서 같은 인스턴스가 재사용될 때 커넥션이 쌓이지 않게 프로덕션에서도 캐시
export const prisma = g.prisma ?? create();
g.prisma = prisma;
