import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inspirations } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { eq, gte, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  // Get start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(inspirations)
    .where(
      and(
        eq(inspirations.createdBy, user.id),
        gte(inspirations.createdAt, monday)
      )
    );

  return NextResponse.json({
    count: result[0]?.count || 0,
    cap: 15,
    isOverCap: (result[0]?.count || 0) >= 15,
  });
}
