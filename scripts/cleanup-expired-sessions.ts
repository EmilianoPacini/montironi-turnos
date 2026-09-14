/**
 * Optional maintenance: delete expired or long-revoked session rows.
 * Usage: npx tsx scripts/cleanup-expired-sessions.ts
 */
import prisma from "../src/lib/db";
import { SESSION_ABSOLUTE_TTL_MS } from "../src/lib/auth/session/constants";

async function main() {
  const cutoff = new Date(Date.now() - SESSION_ABSOLUTE_TTL_MS);
  const result = await prisma.sesion.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: cutoff } },
        { revokedAt: { lt: cutoff } },
      ],
    },
  });
  console.log(`Deleted ${result.count} expired/revoked session row(s) older than ${cutoff.toISOString()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
