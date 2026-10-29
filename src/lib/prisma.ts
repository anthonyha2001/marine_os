import { Prisma, PrismaClient } from "@prisma/client";
import { auditQuery } from "@/lib/audit";

// The database (Supabase, Sydney) is far away: the pooler closes idle connections, and the
// network sometimes drops for a moment. Those errors happen before the query reaches the
// database, so it is safe to retry: up to 3 attempts, pausing 1 s then 2 s.
const RETRYABLE = new Set(["P1017", "P1001"]); // connection closed / database unreachable
const RETRY_DELAYS_MS = [1000, 2000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(e: unknown) {
  return (
    (e instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE.has(e.code)) ||
    (e instanceof Prisma.PrismaClientInitializationError && e.errorCode !== undefined && RETRYABLE.has(e.errorCode))
  );
}

function createClient() {
  const base = new PrismaClient();
  const audit = auditQuery(base);
  return base
    .$extends({ query: { $allModels: { $allOperations: audit } } })
    .$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (e) {
            if (!isRetryable(e) || attempt >= RETRY_DELAYS_MS.length) throw e;
            await sleep(RETRY_DELAYS_MS[attempt]);
          }
        }
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** The client passed to `prisma.$transaction(async (tx) => …)` callbacks. */
export type Tx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
