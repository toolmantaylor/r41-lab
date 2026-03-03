import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getOrCreateUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [newUser] = await db
    .insert(users)
    .values({
      clerkId: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name:
        clerkUser.firstName && clerkUser.lastName
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : clerkUser.firstName ?? clerkUser.username ?? "User",
    })
    .returning();

  return newUser;
}
