import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  inspirations,
  assets,
  annotations,
  producedAds,
  hooks,
} from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;

  const [inspo] = await db
    .select()
    .from(inspirations)
    .where(eq(inspirations.id, id))
    .limit(1);

  if (!inspo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inspoAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.inspirationId, id));

  const inspoAnnotations = await db
    .select()
    .from(annotations)
    .where(eq(annotations.inspirationId, id))
    .orderBy(annotations.timestampMs);

  const inspoProducedAds = await db
    .select()
    .from(producedAds)
    .where(eq(producedAds.inspirationId, id));

  // Fetch hooks for each produced ad
  const adsWithHooks = await Promise.all(
    inspoProducedAds.map(async (ad) => {
      const adHooks = await db
        .select()
        .from(hooks)
        .where(eq(hooks.producedAdId, ad.id))
        .orderBy(hooks.hookNumber);
      return { ...ad, hooks: adHooks };
    })
  );

  return NextResponse.json({
    ...inspo,
    assets: inspoAssets,
    annotations: inspoAnnotations,
    producedAds: adsWithHooks,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Win rate rule: if triage = test, require at least one of hook_type, format, angle
  if (body.triage === "test") {
    // Check existing values if not provided in update
    const [existing] = await db
      .select()
      .from(inspirations)
      .where(eq(inspirations.id, id))
      .limit(1);

    const hookType = body.hookType ?? existing?.hookType;
    const format = body.format ?? existing?.format;
    const angle = body.angle ?? existing?.angle;

    if (!hookType && !format && !angle) {
      return NextResponse.json(
        {
          error:
            "When triage is Test, at least one of hook_type, format, or angle is required",
        },
        { status: 400 }
      );
    }
  }

  // Win rate rule: cannot be "briefed" unless at least 2 annotations
  if (body.status === "briefed") {
    const annotationCount = await db
      .select()
      .from(annotations)
      .where(eq(annotations.inspirationId, id));
    if (annotationCount.length < 2 && !body.briefReason) {
      return NextResponse.json(
        {
          error:
            "Inspiration cannot be Briefed unless it has at least 2 annotations or a brief reason why not",
        },
        { status: 400 }
      );
    }
  }

  const updateData: Record<string, any> = { updatedAt: new Date() };
  const allowedFields = [
    "platform",
    "sourceUrl",
    "advertiserName",
    "brandTag",
    "format",
    "hookType",
    "angle",
    "triage",
    "status",
    "whySaved",
    "notes",
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const [updated] = await db
    .update(inspirations)
    .set(updateData)
    .where(eq(inspirations.id, id))
    .returning();

  return NextResponse.json(updated);
}
