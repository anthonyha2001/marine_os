// Creates both companies, the group admin, and one demo account per role per company.
// Safe to re-run: existing records are left as they are.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Marine2026!";

const companies = [
  { slug: "xpert-marine", name: "Xpert Marine", emailPrefix: "xm" },
  { slug: "eliche-radice", name: "Eliche Radice", emailPrefix: "er" },
];

const companyRoles = [
  ["MANAGER", "manager", "Manager"],
  ["STOCK_WORKER", "stock", "Stock Worker"],
  ["REGULAR_WORKER", "worker", "Regular Worker"],
  ["MARKETING_MANAGER", "marketing", "Marketing Manager"],
  ["CASHIER", "cashier", "Cashier"],
  ["ACCOUNTANT", "accountant", "Accountant"],
] as const;

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // No shared demo admin: pass a real one in when setting up a fresh database, e.g.
  // SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npm run db:setup
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: { email: adminEmail, name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 10) },
    });
  }

  for (const c of companies) {
    const company = await prisma.company.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, name: c.name },
    });

    for (const [role, handle, label] of companyRoles) {
      const email = `${c.emailPrefix}.${handle}@marineos.local`;
      await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, name: `${c.name} ${label}`, role, companyId: company.id, passwordHash },
      });
    }
  }

  console.log(`Seeded. All demo accounts use the password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
