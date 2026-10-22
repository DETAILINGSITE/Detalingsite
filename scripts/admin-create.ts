/**
 * Creates (or resets the password of) an admin user. Sign-up is disabled in the app.
 *
 *   pnpm admin:create --email owner@yourbusiness.com --name "Owner Name" [--role owner|staff]
 *
 * The password is read from ADMIN_PASSWORD or generated and printed once.
 */
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { createDb, createPool } from "@/db/client";
import * as s from "@/db/schema";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = arg("email")?.toLowerCase();
const name = arg("name") ?? "Owner";
const role = (arg("role") ?? "owner") as "owner" | "staff";
if (!email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
  console.error("Usage: pnpm admin:create --email you@example.com --name \"Your Name\" [--role owner|staff]");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
if (password.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const pool = createPool(url, 1);
const db = createDb(pool);
const hash = await hashPassword(password);
const now = new Date();
const [existing] = await db.select().from(s.user).where(eq(s.user.email, email));
if (existing) {
  await db.update(s.user).set({ name, role, updatedAt: now }).where(eq(s.user.id, existing.id));
  await db.update(s.account).set({ password: hash, updatedAt: now }).where(eq(s.account.userId, existing.id));
  console.log(`Updated ${role} ${email}.`);
} else {
  const id = randomUUID();
  await db.insert(s.user).values({ id, name, email, emailVerified: true, role, createdAt: now, updatedAt: now });
  await db.insert(s.account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: hash,
    createdAt: now,
    updatedAt: now,
  });
  console.log(`Created ${role} ${email}.`);
}
if (!process.env.ADMIN_PASSWORD) console.log(`Temporary password (shown once): ${password}`);
await pool.end();
