import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { annotations } from "@/lib/db/schema";
import { getOrCreateUser } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";

  let inspirationId: string;
  let timestampMs: number | null = null;
  let pinX: string | null = null;
  let pinY: string | null = null;
  let type: string;
  let text: string | null = null;
  let audioR2Key: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    inspirationId = formData.get("inspirationId") as string;
    const tsVal = formData.get("timestampMs") as string;
    timestampMs = tsVal ? parseInt(tsVal) : null;
    pinX = (formData.get("pinX") as string) || null;
    pinY = (formData.get("pinY") as string) || null;
    type = (formData.get("type") as string) || "voice";
    text = (formData.get("text") as string) || null;

    const audioFile = formData.get("audio") as File | null;
    if (audioFile) {
      const annotationId = uuidv4();
      audioR2Key = `annotations/${annotationId}/voice.webm`;
      const buffer = Buffer.from(await audioFile.arrayBuffer());
      await uploadToR2(audioR2Key, buffer, audioFile.type || "audio/webm");

      const [annotation] = await db
        .insert(annotations)
        .values({
          id: annotationId,
          inspirationId,
          timestampMs,
          pinX,
          pinY,
          type: type as any,
          text,
          audioR2Key,
          createdBy: user.id,
        })
        .returning();

      return NextResponse.json(annotation, { status: 201 });
    }
  } else {
    const body = await req.json();
    inspirationId = body.inspirationId;
    timestampMs = body.timestampMs ?? null;
    pinX = body.pinX ?? null;
    pinY = body.pinY ?? null;
    type = body.type || "other";
    text = body.text || null;
  }

  if (!inspirationId) {
    return NextResponse.json(
      { error: "inspirationId is required" },
      { status: 400 }
    );
  }

  const [annotation] = await db
    .insert(annotations)
    .values({
      inspirationId,
      timestampMs,
      pinX,
      pinY,
      type: type as any,
      text,
      audioR2Key,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json(annotation, { status: 201 });
}
