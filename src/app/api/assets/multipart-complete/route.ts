import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/auth";
import { completeMultipartUpload, abortMultipartUpload } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();
    const { r2Key, uploadId, parts, abort } = body;

    if (!r2Key || !uploadId) {
      return NextResponse.json(
        { error: "r2Key and uploadId are required" },
        { status: 400 }
      );
    }

    // If abort flag is set, cancel the multipart upload
    if (abort) {
      await abortMultipartUpload(r2Key, uploadId);
      return NextResponse.json({ success: true, aborted: true });
    }

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json(
        { error: "parts array is required to complete upload" },
        { status: 400 }
      );
    }

    // Sort parts by part number before completing
    const sortedParts = parts
      .map((p: { partNumber: number; etag: string }) => ({
        PartNumber: p.partNumber,
        ETag: p.etag,
      }))
      .sort((a: { PartNumber: number }, b: { PartNumber: number }) => a.PartNumber - b.PartNumber);

    await completeMultipartUpload(r2Key, uploadId, sortedParts);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Multipart complete error:", error);
    return NextResponse.json(
      { error: "Internal server error: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}
