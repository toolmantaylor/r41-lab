import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { performanceLogs } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();

  if (!body.producedAdId) {
    return NextResponse.json(
      { error: "producedAdId is required" },
      { status: 400 }
    );
  }

  // Win rate rule: verdict and learning are required
  if (!body.verdict) {
    return NextResponse.json(
      { error: "verdict is required" },
      { status: 400 }
    );
  }

  if (!body.learning || body.learning.trim() === "") {
    return NextResponse.json(
      { error: "learning is required" },
      { status: 400 }
    );
  }

  const [log] = await db
    .insert(performanceLogs)
    .values({
      producedAdId: body.producedAdId,
      dateStart: body.dateStart || null,
      dateEnd: body.dateEnd || null,
      spend: body.spend || null,
      purchases: body.purchases || null,
      revenue: body.revenue || null,
      cpa: body.cpa || null,
      ctr: body.ctr || null,
      cvr: body.cvr || null,
      verdict: body.verdict,
      learning: body.learning,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json(log, { status: 201 });
}
