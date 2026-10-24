"use server";

import { revalidatePath } from "next/cache";
import { seedAll } from "@/db/seed";
import { terminateUser } from "@/lib/hr";
import { reqFromHeaders } from "@/lib/request";
import { currentUser } from "@/lib/session";

export async function terminateAction(fd: FormData) {
  const user = await currentUser();
  if (user?.role !== "admin") return;
  await terminateUser(String(fd.get("username")), "hr-webhook", await reqFromHeaders("/admin"));
  revalidatePath("/admin");
}

export async function resetAction() {
  const user = await currentUser();
  if (user?.role !== "admin") return;
  await seedAll(); // also sets mode back to legacy and clears all sessions (including the admin's)
  revalidatePath("/", "layout");
}
