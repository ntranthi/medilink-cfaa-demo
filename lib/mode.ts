import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type Mode = "legacy" | "hardened";

export async function getMode(): Promise<Mode> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "security_mode") });
  return row?.value === "hardened" ? "hardened" : "legacy";
}

export async function setMode(mode: Mode) {
  await db
    .insert(settings)
    .values({ key: "security_mode", value: mode })
    .onConflictDoUpdate({ target: settings.key, set: { value: mode } });
}
