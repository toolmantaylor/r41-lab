import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inspirations, assets, annotations } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { eq, desc, and, ilike, sql, SQL } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();

  if (!body.whySaved || body.whySaved.trim() === "") {
    return NextResponse.json(
      { error: "why_saved is required" },
      { status: 400 }
    );
  }

  // Win rate rule: if triage = test, require at least one of hook_type, format, angle
  if (body.triage === "test") {
    if (!body.hookType && !body.format && !body.angle) {
      return NextResponse.json(
        {
          error:
            "When triage is Test, at least one of hook_type, format, or angle is required",
        },
        { status: 400 }
      );
    }
  }

  const [inspo] = await db
    .insert(inspirations)
    .values({
      platform: body.platform || "other",
      sourceUrl: body.sourceUrl || null,
      advertiserName: body.advertiserName || null,
      brandTag: body.brandTag || null,
      format: body.format || null,
      hookType: body.hookType || null,
      angle: body.angle || null,
      triage: body.triage || null,
      status: body.status || "inbox",
      whySaved: body.whySaved,
      notes: body.notes || null,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json(inspo, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const triage = searchParams.get("triage");
  const platform = searchParams.get("platform");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") || "newest";

  const conditions: SQL[] = [];

  if (status) {
    conditions.push(eq(inspirations.status, status as any));
  }
  if (triage) {
    conditions.push(eq(inspirations.triage, triage as any));
  }
  if (platform) {
    conditions.push(eq(inspirations.platform, platform as any));
  }
  if (search) {
    conditions.push(
      sql`(${inspirations.whySaved} ILIKE ${"%" + search + "%"} OR ${inspirations.notes} ILIKE ${"%" + search + "%"})`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select()
    .from(inspirations)
    .where(where)
    .orderBy(desc(inspirations.createdAt))
    .limit(100);

  // Fetch assets for thumbnails
  const inspoIds = results.map((r) => r.id);
  let assetsMap: Record<string, any[]> = {};
  if (inspoIds.length > 0) {
    const allAssets = await db
      .select()
      .from(assets)
      .where(sql`${assets.inspirationId} IN ${inspoIds}`);
    for (const a of allAssets) {
      if (!assetsMap[a.inspirationId]) assetsMap[a.inspirationId] = [];
      assetsMap[a.inspirationId].push(a);
    }
  }

  // Fetch annotation counts
  let annotationCounts: Record<string, number> = {};
  if (inspoIds.length > 0) {
    const counts = await db
      .select({
        inspirationId: annotations.inspirationId,
        count: sql<number>`count(*)::int`,
      })
      .from(annotations)
      .where(sql`${annotations.inspirationId} IN ${inspoIds}`)
      .groupBy(annotations.inspirationId);
    for (const c of counts) {
      annotationCounts[c.inspirationId] = c.count;
    }
  }

  const enriched = results.map((r) => ({
    ...r,
    assets: assetsMap[r.id] || [],
    annotationCount: annotationCounts[r.id] || 0,
  }));

  return NextResponse.json(enriched);
}
