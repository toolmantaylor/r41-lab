import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { producedAds, hooks, performanceLogs } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { desc, eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();

  if (!body.internalName || !body.publicName || !body.inspirationId) {
    return NextResponse.json(
      { error: "internalName, publicName, and inspirationId are required" },
      { status: 400 }
    );
  }

  const [ad] = await db
    .insert(producedAds)
    .values({
      inspirationId: body.inspirationId,
      internalName: body.internalName,
      publicName: body.publicName,
      scriptUrl: body.scriptUrl || null,
      editor: body.editor || null,
      status: body.status || "in_production",
      platform: body.platform || null,
      liveDate: body.liveDate || null,
      campaign: body.campaign || null,
    })
    .returning();

  return NextResponse.json(ad, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const allAds = await db
    .select()
    .from(producedAds)
    .orderBy(desc(producedAds.createdAt));

  // Fetch hooks and latest performance for each ad
  const enriched = await Promise.all(
    allAds.map(async (ad) => {
      const adHooks = await db
        .select()
        .from(hooks)
        .where(eq(hooks.producedAdId, ad.id))
        .orderBy(hooks.hookNumber);

      const perfLogs = await db
        .select()
        .from(performanceLogs)
        .where(eq(performanceLogs.producedAdId, ad.id))
        .orderBy(desc(performanceLogs.dateEnd));

      return {
        ...ad,
        hooks: adHooks,
        performanceLogs: perfLogs,
        latestPerformance: perfLogs[0] || null,
      };
    })
  );

  return NextResponse.json(enriched);
}
