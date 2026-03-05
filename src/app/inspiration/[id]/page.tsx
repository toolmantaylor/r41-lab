"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface AssetData {
  id: string;
  type: string;
  r2Key: string;
  mimeType: string;
  thumbnailR2Key: string | null;
  durationSeconds: number | null;
}

interface AnnotationData {
  id: string;
  timestampMs: number | null;
  pinX: string | null;
  pinY: string | null;
  type: string;
  text: string | null;
  audioR2Key: string | null;
  createdAt: string;
}

interface InspirationDetail {
  id: string;
  platform: string;
  sourceUrl: string | null;
  advertiserName: string | null;
  brandTag: string | null;
  format: string | null;
  hookType: string | null;
  angle: string | null;
  triage: string | null;
  status: string;
  whySaved: string;
  notes: string | null;
  assets: AssetData[];
  annotations: AnnotationData[];
  producedAds: any[];
  createdAt: string;
}

const ANNOTATION_TYPES = [
  "hook",
  "structure",
  "mechanism",
  "offer",
  "social_proof",
  "urgency",
  "other",
];

export default function InspirationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setS] = useState(false);
  const [data, setData] = useState<InspirationDetail | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({
    whySaved: "",
    notes: "",
    advertiserName: "",
    brandTag: "",
    format: "",
    hookType: "",
    angle: "",
    platform: "other",
    status: "inbox",
    sourceUrl: "",
  });

  const [showBriefModal, setShowBriefModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [annotationAudioUrls, setAnnotationAudioUrls] = useState<
    Record<string, string>
  >({});
  const [recordingAnnotationId, setRecordingAnnotationId] = useState<
    string | null
  >(null);
  const [recordingAudio, setRecordingAudio] = useState<Blob | null>(null);
  const [pinPosition, setPinPosition] = useState<{ x: number; y: number } | null>(
    null
  );
  const [selectedAnnotationType, setSelectedAnnotationType] = useState<string>(
    "hook"
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inspirations/${id}`);
    const d = await res.json();
    setData(d);
    setEditFields({
      whySaved: d.whySaved || "",
      notes: d.notes || "",
      advertiserName: d.advertiserName || "",
      brandTag: d.brandTag || "",
      format: d.format || "",
      hookType: d.hookType || "",
      angle: d.angle || "",
      platform: d.platform || "other",
      status: d.status || "inbox",
      sourceUrl: d.sourceUrl || "",
    });
    setLoading(false);

    // Fetch asset URL
    if (d.assets?.length > 0) {
      const urlRes = await fetch(`/api/assets/${d.assets[0].id}/signed-url`);
      const urlData = await urlRes.json();
      setAssetUrl(urlData.url);
    }

    // Fetch audio URLs for voice annotations
    for (const ann of d.annotations) {
      if (ann.audioR2Key) {
        try {
          const audioRes = await fetch(`/api/annotations/${ann.id}/audio`);
          const audioData = await audioRes.json();
          if (audioData.url) {
            setAnnotationAudioUrls((prev) => ({
              ...prev,
              [ann.id]: audioData.url,
            }));
          }
        } catch {
          // skip failed audio fetches
        }
      }
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveFields = async () => {
    setS(true);
    await fetch(`/api/inspirations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editFields),
    });
    setS(false);
    fetchData();
  };

  const generateVideoThumbnail = async (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          canvas.toBlob((blob) => {
            resolve(blob);
          }, "image/jpeg", 0.8);
        }
      };

      video.onerror = () => resolve(null);

      const url = URL.createObjectURL(file);
      video.src = url;
    });
  };

  // Upload a single chunk via XMLHttpRequest with progress tracking
  const uploadChunkWithProgress = (
    url: string,
    chunk: Blob,
    onProgress: (loaded: number) => void
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url, true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag") || "";
          resolve(etag);
        } else {
          reject(new Error(`Chunk upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during chunk upload"));
      xhr.ontimeout = () => reject(new Error("Chunk upload timed out"));
      xhr.timeout = 300000; // 5 minutes per chunk

      xhr.send(chunk);
    });
  };

  // Retry wrapper for chunk uploads
  const uploadChunkWithRetry = async (
    url: string,
    chunk: Blob,
    onProgress: (loaded: number) => void,
    maxRetries = 3
  ): Promise<string> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await uploadChunkWithProgress(url, chunk, onProgress);
      } catch (err) {
        if (attempt === maxRetries - 1) throw err;
        console.warn(`Chunk upload attempt ${attempt + 1} failed, retrying...`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw new Error("Chunk upload failed after retries");
  };

  const MULTIPART_THRESHOLD = 20 * 1024 * 1024; // 20MB
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per part
  const CONCURRENT_UPLOADS = 3;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      console.log("Starting upload for file:", file.name, file.type, file.size);
      const totalSize = file.size;
      let assetId: string;
      let r2Key: string;
      let assetType: string;

      if (totalSize <= MULTIPART_THRESHOLD) {
        // Small file: single presigned PUT
        const presignRes = await fetch("/api/assets/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inspirationId: id,
            mimeType: file.type,
            filename: file.name,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({ error: "Presign failed" }));
          throw new Error(err.error || `Presign failed: ${presignRes.status}`);
        }

        const presignData = await presignRes.json();
        assetId = presignData.assetId;
        r2Key = presignData.r2Key;
        assetType = presignData.assetType;

        // Upload with XHR for progress
        await uploadChunkWithProgress(presignData.uploadUrl, file, (loaded) => {
          setUploadProgress(Math.round((loaded / totalSize) * 100));
        });
      } else {
        // Large file: multipart upload
        console.log("Using multipart upload for large file");

        // Step 1: Initiate multipart upload
        const initRes = await fetch("/api/assets/multipart-init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inspirationId: id,
            mimeType: file.type,
            filename: file.name,
          }),
        });

        if (!initRes.ok) {
          const err = await initRes.json().catch(() => ({ error: "Init failed" }));
          throw new Error(err.error || `Multipart init failed: ${initRes.status}`);
        }

        const initData = await initRes.json();
        assetId = initData.assetId;
        r2Key = initData.r2Key;
        assetType = initData.assetType;
        const uploadId = initData.uploadId;

        // Step 2: Calculate parts
        const totalParts = Math.ceil(totalSize / CHUNK_SIZE);
        const allPartNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
        console.log(`File split into ${totalParts} parts of ${CHUNK_SIZE / 1024 / 1024}MB each`);

        // Step 3: Get presigned URLs for all parts
        const presignRes = await fetch("/api/assets/multipart-presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ r2Key, uploadId, partNumbers: allPartNumbers }),
        });

        if (!presignRes.ok) {
          // Abort the multipart upload on failure
          await fetch("/api/assets/multipart-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ r2Key, uploadId, abort: true }),
          }).catch(() => {});
          const err = await presignRes.json().catch(() => ({ error: "Presign failed" }));
          throw new Error(err.error || `Part presign failed: ${presignRes.status}`);
        }

        const { urls } = await presignRes.json();

        // Step 4: Upload parts with concurrency and progress tracking
        const completedParts: { partNumber: number; etag: string }[] = [];
        const partProgress: number[] = new Array(totalParts).fill(0);

        const updateTotalProgress = () => {
          const totalLoaded = partProgress.reduce((sum, p) => sum + p, 0);
          setUploadProgress(Math.round((totalLoaded / totalSize) * 100));
        };

        // Process parts in batches of CONCURRENT_UPLOADS
        for (let i = 0; i < totalParts; i += CONCURRENT_UPLOADS) {
          const batch = allPartNumbers.slice(i, i + CONCURRENT_UPLOADS);
          const batchResults = await Promise.all(
            batch.map(async (partNumber) => {
              const start = (partNumber - 1) * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, totalSize);
              const chunk = file.slice(start, end);
              const partIndex = partNumber - 1;

              const etag = await uploadChunkWithRetry(
                urls[partNumber],
                chunk,
                (loaded) => {
                  partProgress[partIndex] = loaded;
                  updateTotalProgress();
                }
              );

              // Mark this part as fully uploaded
              partProgress[partIndex] = end - start;
              updateTotalProgress();

              return { partNumber, etag };
            })
          );

          completedParts.push(...batchResults);
        }

        // Step 5: Complete multipart upload
        console.log("All parts uploaded, completing multipart upload...");
        const completeRes = await fetch("/api/assets/multipart-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            r2Key,
            uploadId,
            parts: completedParts,
          }),
        });

        if (!completeRes.ok) {
          const err = await completeRes.json().catch(() => ({ error: "Complete failed" }));
          throw new Error(err.error || `Multipart complete failed: ${completeRes.status}`);
        }
      }

      setUploadProgress(100);
      console.log("R2 upload successful.");

      // Generate and upload thumbnail for videos
      let thumbnailR2Key: string | null = null;
      if (file.type.startsWith("video/")) {
        try {
          const thumbBlob = await generateVideoThumbnail(file);
          if (thumbBlob) {
            const thumbPresignRes = await fetch("/api/assets/presign-thumb", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ inspirationId: id, assetId }),
            });

            if (thumbPresignRes.ok) {
              const { thumbnailR2Key: tKey, uploadUrl: tUrl } =
                await thumbPresignRes.json();

              const thumbUploadRes = await fetch(tUrl, {
                method: "PUT",
                headers: { "Content-Type": "image/jpeg" },
                body: thumbBlob,
              });

              if (thumbUploadRes.ok) {
                thumbnailR2Key = tKey;
              }
            }
          }
        } catch (thumbErr) {
          console.error("Thumbnail generation failed:", thumbErr);
        }
      }

      // Register asset in database
      const registerRes = await fetch("/api/assets/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          inspirationId: id,
          r2Key,
          thumbnailR2Key,
          mimeType: file.type,
          assetType,
          fileSizeBytes: file.size,
        }),
      });

      if (!registerRes.ok) {
        const err = await registerRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to register asset");
      }

      fetchData();
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const getCurrentTimestamp = (): number | null => {
    if (videoRef.current) {
      return Math.round(videoRef.current.currentTime * 1000);
    }
    return null;
  };

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement | HTMLImageElement>) => {
    const video = e.currentTarget;
    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPinPosition({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
  };

  const handleAddTextAnnotation = async () => {
    if (!pinPosition) return;

    const text = prompt("Enter annotation text:");
    if (!text) {
      setPinPosition(null);
      return;
    }

    const res = await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inspirationId: id,
        type: selectedAnnotationType,
        text,
        timestampMs: getCurrentTimestamp(),
        pinX: pinPosition.x.toString(),
        pinY: pinPosition.y.toString(),
      }),
    });

    if (res.ok) {
      setPinPosition(null);
      fetchData();
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setRecordingAudio(blob);
      };

      mediaRecorder.start();
      setRecordingAnnotationId("recording");

      setTimeout(() => {
        mediaRecorder.stop();
        stream.getTracks().forEach((t) => t.stop());
        setRecordingAnnotationId(null);
      }, 30000);
    } catch (e) {
      alert("Microphone access denied");
    }
  };

  const handleSaveVoiceAnnotation = async () => {
    if (!recordingAudio || !pinPosition) return;

    const formData = new FormData();
    formData.append("audio", recordingAudio);
    formData.append("inspirationId", id);
    formData.append("type", selectedAnnotationType);
    formData.append("timestampMs", getCurrentTimestamp()?.toString() || "");
    formData.append("pinX", pinPosition.x.toString());
    formData.append("pinY", pinPosition.y.toString());

    const res = await fetch("/api/annotations", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      setRecordingAudio(null);
      setPinPosition(null);
      fetchData();
    }
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    if (confirm("Delete this annotation?")) {
      await fetch(`/api/annotations/${annotationId}`, { method: "DELETE" });
      fetchData();
    }
  };

  const handleCreateProducedAd = async () => {
    const internalName = prompt("Internal name (e.g., ad_001_hook_variant_1):");
    if (!internalName) return;

    const res = await fetch("/api/produced-ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inspirationId: id,
        internalName,
        publicName: prompt("Public name (optional):") || null,
      }),
    });

    if (res.ok) {
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-zinc-400">Loading...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="text-zinc-400">Not found</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{data.advertiserName || "Untitled"}</h1>
          <p className="text-sm text-zinc-500">
            {data.platform} • {new Date(data.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Link
          href="/inbox"
          className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700"
        >
          Back to Inbox
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Asset viewer */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            {assetUrl && data.assets[0]?.type === "video" && (
              <video
                ref={videoRef}
                src={assetUrl}
                controls
                onClick={handleVideoClick}
                className="aspect-video w-full cursor-crosshair rounded bg-black"
              />
            )}
            {assetUrl && data.assets[0]?.type === "image" && (
              <img
                src={assetUrl}
                alt="Asset"
                onClick={handleVideoClick}
                className="aspect-video w-full cursor-crosshair rounded object-cover"
              />
            )}
            {!assetUrl && !uploading && (
              <div className="flex aspect-video items-center justify-center text-zinc-600">
                <div className="text-center">
                  <p className="mb-2">No asset uploaded</p>
                  {uploadError && (
                    <p className="mb-3 rounded border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-400">
                      {uploadError}
                    </p>
                  )}
                  <label className="cursor-pointer rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-zinc-700">
                    Upload Asset
                    <input
                      type="file"
                      className="hidden"
                      accept="video/webm,video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <p className="mt-2 text-xs text-zinc-600">MP4, WebM, MOV, JPG, PNG, WebP</p>
                </div>
              </div>
            )}
            {uploading && (
              <div className="flex aspect-video items-center justify-center bg-zinc-900">
                <div className="text-center">
                  <div className="mb-2 text-2xl font-bold text-white">{uploadProgress}%</div>
                  <div className="mb-3 h-2 w-64 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-400">
                    {uploadProgress < 100 ? "Uploading to storage..." : "Finalising..."}
                  </span>
                  <p className="mt-1 text-xs text-zinc-600">
                    {uploadProgress < 100
                      ? "Do not close this page during upload"
                      : "Almost done"}
                  </p>
                </div>
              </div>
            )}

            {/* Annotation pins overlay */}
            {assetUrl && (
              <div className="relative mt-2 text-xs text-zinc-500">
                {data.annotations.map((a) => (
                  <div
                    key={a.id}
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow-lg"
                    style={{
                      left: `${parseFloat(a.pinX!) * 100}%`,
                      top: `${parseFloat(a.pinY!) * 100}%`,
                    }}
                    title={a.text || a.type}
                  />
                ))}
                {pinPosition && (
                  <div
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-white bg-yellow-500 shadow-lg"
                    style={{
                      left: `${pinPosition.x * 100}%`,
                      top: `${pinPosition.y * 100}%`,
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Annotations */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 font-semibold">Annotations</h3>

            {pinPosition && (
              <div className="mb-4 rounded border border-yellow-800 bg-yellow-900/30 p-3">
                <p className="mb-2 text-sm text-yellow-400">
                  Pin active at {Math.round(pinPosition.x * 100)}%, {Math.round(pinPosition.y * 100)}%
                </p>
                <div className="flex gap-2">
                  <select
                    value={selectedAnnotationType}
                    onChange={(e) => setSelectedAnnotationType(e.target.value)}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                  >
                    {ANNOTATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddTextAnnotation}
                    className="rounded bg-yellow-900 px-2 py-1 text-xs text-yellow-300 transition hover:bg-yellow-800"
                  >
                    Add Text
                  </button>
                  <button
                    onClick={handleStartRecording}
                    className="rounded bg-yellow-900 px-2 py-1 text-xs text-yellow-300 transition hover:bg-yellow-800"
                  >
                    Record Voice
                  </button>
                  <button
                    onClick={() => setPinPosition(null)}
                    className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {recordingAudio && (
              <div className="mb-4 rounded border border-green-800 bg-green-900/30 p-3">
                <p className="mb-2 text-sm text-green-400">Voice recording ready</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveVoiceAnnotation}
                    className="rounded bg-green-900 px-2 py-1 text-xs text-green-300 transition hover:bg-green-800"
                  >
                    Save Voice Note
                  </button>
                  <button
                    onClick={() => setRecordingAudio(null)}
                    className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-700"
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {data.annotations.map((ann) => (
                <div
                  key={ann.id}
                  className="rounded border border-zinc-700 bg-zinc-800 p-2 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-zinc-400">
                        {ann.type} at {ann.timestampMs ? `${ann.timestampMs}ms` : "image"}
                      </p>
                      {ann.text && <p className="text-zinc-300">{ann.text}</p>}
                      {ann.audioR2Key && (
                        <audio
                          src={annotationAudioUrls[ann.id]}
                          controls
                          className="mt-1 h-6 w-full"
                        />
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAnnotation(ann.id)}
                      className="text-red-500 transition hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Fields */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-400">Why Saved</label>
              <textarea
                value={editFields.whySaved}
                onChange={(e) =>
                  setEditFields({ ...editFields, whySaved: e.target.value })
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400">Notes</label>
              <textarea
                value={editFields.notes}
                onChange={(e) =>
                  setEditFields({ ...editFields, notes: e.target.value })
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400">Advertiser</label>
              <input
                type="text"
                value={editFields.advertiserName}
                onChange={(e) =>
                  setEditFields({ ...editFields, advertiserName: e.target.value })
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400">Brand Tag</label>
              <input
                type="text"
                value={editFields.brandTag}
                onChange={(e) =>
                  setEditFields({ ...editFields, brandTag: e.target.value })
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400">Format</label>
              <select
                value={editFields.format}
                onChange={(e) =>
                  setEditFields({ ...editFields, format: e.target.value })
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              >
                <option value="">Select...</option>
                <option value="carousel">Carousel</option>
                <option value="reel">Reel</option>
                <option value="story">Story</option>
                <option value="static">Static</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400">Hook Type</label>
              <select
                value={editFields.hookType}
                onChange={(e) =>
                  setEditFields({ ...editFields, hookType: e.target.value })
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              >
                <option value="">Select...</option>
                <option value="pattern_interrupt">Pattern Interrupt</option>
                <option value="curiosity">Curiosity</option>
                <option value="benefit">Benefit</option>
                <option value="story">Story</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400">Angle</label>
              <input
                type="text"
                value={editFields.angle}
                onChange={(e) =>
                  setEditFields({ ...editFields, angle: e.target.value })
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400">Triage</label>
              <select
                value={editFields.status}
                onChange={(e) =>
                  setEditFields({ ...editFields, status: e.target.value })
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              >
                <option value="inbox">Inbox</option>
                <option value="test">Test</option>
                <option value="archive">Archive</option>
              </select>
            </div>

            <button
              onClick={handleSaveFields}
              disabled={saving}
              className="w-full rounded bg-blue-900 px-3 py-1.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          {/* Produced Ads */}
          <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Produced Ads</h3>
              <button
                onClick={handleCreateProducedAd}
                className="text-xs text-blue-400 transition hover:text-blue-300"
              >
                + New
              </button>
            </div>
            <div className="space-y-2">
              {data.producedAds.map((ad) => (
                <Link
                  key={ad.id}
                  href={`/produced-ads/${ad.id}`}
                  className="block rounded border border-zinc-700 bg-zinc-800 p-2 text-xs text-zinc-300 transition hover:bg-zinc-700"
                >
                  {ad.internalName}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
