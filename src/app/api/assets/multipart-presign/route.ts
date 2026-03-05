import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { getSignedPartUrl } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();
    const { r2Key, uploadId, partNumbers } = body;

    if (!r2Key || !uploadId || !partNumbers || !Array.isArray(partNumbers)) {
      return NextResponse.json(
        { error: "r2Key, uploadId, and partNumbers are required" },
        { status: 400 }
      );
    }

    // Generate presigned URLs for all requested parts in parallel
    const urls: Record<number, string> = {};
    await Promise.all(
      partNumbers.map(async (partNumber: number) => {
        const url = await getSignedPartUrl(r2Key, uploadId, partNumber, 3600);
        urls[partNumber] = url;
      })
    );

    return NextResponse.json({ urls });
  } catch (error: any) {
    console.error("Multipart presign error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}
