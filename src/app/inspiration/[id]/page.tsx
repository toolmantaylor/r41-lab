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
  "proof",
  "objection",
  "cta",
  "visual",
  "voice",
  "other",
];

const STATUSES = ["inbox", "shortlisted", "annotated", "briefed", "archived"];

export default function InspirationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<InspirationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [annotationAudioUrls, setAnnotationAudioUrls] = useState<
    Record<string, string>
  >({});

  // Editing state
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Annotation creation
  const [newAnnotation, setNewAnnotation] = useState({
    type: "hook",
    text: "",
  });
  const [pinMode, setPinMode] = useState(false);
  const [pinPosition, setPinPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  // Brief creation
  const [showBriefModal, setShowBriefModal] = useState(false);

  // File upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    setSaving(true);
    await fetch(`/api/inspirations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editFields),
    });
    setSaving(false);
    fetchData();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected after an error
    e.target.value = "";

    setUploading(true);
    setUploadError(null);

    try {
      // Step 1: Get a presigned PUT URL from our API
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
        const err = await presignRes.json();
        throw new Error(err.error || "Failed to get upload URL");
      }

      const { assetId, r2Key, uploadUrl, assetType } = await presignRes.json();

      // Step 2: Upload the file via the Edge proxy (no body size limit)
      const proxyUrl = `/api/assets/upload-edge?url=${encodeURIComponent(uploadUrl)}`;
      const uploadRes = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || `Upload failed with status ${uploadRes.status}`);
      }

      // Step 3: Generate and upload thumbnail for videos
      let thumbnailR2Key: string | null = null;
      if (file.type.startsWith("video/")) {
        try {
          const thumbBlob = await generateVideoThumbnail(file);
          if (thumbBlob) {
            // Get presigned URL for thumbnail
            const thumbPresignRes = await fetch("/api/assets/presign-thumb", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ inspirationId: id, assetId }),
            });
            if (thumbPresignRes.ok) {
              const { thumbnailR2Key: tKey, uploadUrl: tUrl } = await thumbPresignRes.json();
              const thumbUploadRes = await fetch(
                `/api/assets/upload-edge?url=${encodeURIComponent(tUrl)}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "image/jpeg" },
                  body: thumbBlob,
                }
              );
              if (thumbUploadRes.ok) {
                thumbnailR2Key = tKey;
              }
            }
          }
        } catch (thumbErr) {
          console.error("Thumbnail generation failed:", thumbErr);
          // Non-fatal: continue without thumbnail
        }
      }

      // Step 4: Register the asset in the database
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
        const err = await registerRes.json();
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

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPinPosition({ x, y });
  };

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!pinMode) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPinPosition({ x, y });
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      alert("Microphone access is required for voice annotations");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleAddAnnotation = async () => {
    const timestampMs = getCurrentTimestamp();

    const fd = new FormData();
    fd.append("inspirationId", id);
    fd.append("type", audioBlob ? "voice" : newAnnotation.type);
    if (newAnnotation.text) fd.append("text", newAnnotation.text);
    if (timestampMs !== null) fd.append("timestampMs", timestampMs.toString());
    if (pinPosition) {
      fd.append("pinX", pinPosition.x.toFixed(4));
      fd.append("pinY", pinPosition.y.toFixed(4));
    }
    if (audioBlob) {
      fd.append("audio", audioBlob, "voice.webm");
    }

    await fetch("/api/annotations", {
      method: "POST",
      body: fd,
    });

    setNewAnnotation({ type: "hook", text: "" });
    setPinPosition(null);
    setPinMode(false);
    setAudioBlob(null);
    fetchData();
  };

  const handleDeleteAnnotation = async (annId: string) => {
    await fetch(`/api/annotations/${annId}`, { method: "DELETE" });
    fetchData();
  };

  const seekToTimestamp = (ms: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = ms / 1000;
      videoRef.current.play();
    }
  };

  const formatTimestamp = (ms: number | null) => {
    if (ms === null) return "--:--";
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const typeColour = (t: string) => {
    const map: Record<string, string> = {
      hook: "bg-rose-900/40 text-rose-300",
      structure: "bg-blue-900/40 text-blue-300",
      mechanism: "bg-violet-900/40 text-violet-300",
      offer: "bg-emerald-900/40 text-emerald-300",
      proof: "bg-cyan-900/40 text-cyan-300",
      objection: "bg-orange-900/40 text-orange-300",
      cta: "bg-pink-900/40 text-pink-300",
      visual: "bg-indigo-900/40 text-indigo-300",
      voice: "bg-amber-900/40 text-amber-300",
      other: "bg-zinc-800 text-zinc-400",
    };
    return map[t] || map.other;
  };

  if (loading || !data) {
    return <div className="py-20 text-center text-zinc-500">Loading...</div>;
  }

  const primaryAsset = data.assets[0];
  const isVideo = primaryAsset?.type === "video";
  const isImage = primaryAsset?.type === "image";

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="text-zinc-500 transition hover:text-white">
          &larr; Board
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-300">Inspiration Detail</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Media Player */}
        <div className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {assetUrl && isVideo && (
              <div className="relative">
                <video
                  ref={videoRef}
                  src={assetUrl}
                  controls
                  className={`w-full ${pinMode ? "cursor-crosshair" : ""}`}
                  onClick={handleVideoClick}
                />
                {/* Show pins on video */}
                {data.annotations
                  .filter((a) => a.pinX && a.pinY)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow-lg"
                      style={{
                        left: `${parseFloat(a.pinX!) * 100}%`,
                        top: `${parseFloat(a.pinY!) * 100}%`,
                      }}
                      title={a.text || a.type}
                    />
                  ))}
                {pinPosition && (
                  <div
                    className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-white bg-yellow-500 shadow-lg"
                    style={{
                      left: `${pinPosition.x * 100}%`,
                      top: `${pinPosition.y * 100}%`,
                    }}
                  />
                )}
              </div>
            )}
            {assetUrl && isImage && (
              <div
                ref={imageRef}
                className={`relative ${pinMode ? "cursor-crosshair" : ""}`}
                onClick={handleImageClick}
              >
                <img src={assetUrl} alt="" className="w-full" />
                {/* Show pins */}
                {data.annotations
                  .filter((a) => a.pinX && a.pinY)
                  .map((a) => (
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
                  <div className="mb-3 h-1.5 w-48 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full animate-pulse rounded-full bg-white/60" style={{ width: "60%" }} />
                  </div>
                  <span className="text-sm text-zinc-400">Uploading to storage...</span>
                  <p className="mt-1 text-xs text-zinc-600">Large files may take a moment</p>
                </div>
              </div>
            )}
          </div>

          {/* Upload button if asset exists but want to add more */}
          {assetUrl && (
            <div className="mt-2">
              <label className="cursor-pointer text-xs text-zinc-500 transition hover:text-zinc-300">
                + Upload additional asset
                <input
                  type="file"
                  className="hidden"
                  accept="video/webm,video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          )}

          {/* Annotation creation */}
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">
              Add Annotation
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Type</label>
                <select
                  value={newAnnotation.type}
                  onChange={(e) =>
                    setNewAnnotation((a) => ({ ...a, type: e.target.value }))
                  }
                  className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                >
                  {ANNOTATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="mb-1 block text-xs text-zinc-500">Note</label>
                <input
                  type="text"
                  value={newAnnotation.text}
                  onChange={(e) =>
                    setNewAnnotation((a) => ({ ...a, text: e.target.value }))
                  }
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  placeholder="Annotation text..."
                />
              </div>

              <button
                onClick={() => setPinMode(!pinMode)}
                className={`rounded px-3 py-1.5 text-sm transition ${
                  pinMode
                    ? "bg-yellow-600 text-white"
                    : "border border-zinc-700 text-zinc-400 hover:text-white"
                }`}
              >
                {pinMode ? "Pin Mode ON" : "Pin"}
              </button>

              {/* Voice recording */}
              {!recording && !audioBlob && (
                <button
                  onClick={startRecording}
                  className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-red-600 hover:text-red-400"
                >
                  Record Voice
                </button>
              )}
              {recording && (
                <button
                  onClick={stopRecording}
                  className="animate-pulse rounded bg-red-600 px-3 py-1.5 text-sm text-white"
                >
                  Stop Recording
                </button>
              )}
              {audioBlob && !recording && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400">
                    Voice recorded
                  </span>
                  <button
                    onClick={() => setAudioBlob(null)}
                    className="text-xs text-zinc-500 hover:text-red-400"
                  >
                    Discard
                  </button>
                </div>
              )}

              <button
                onClick={handleAddAnnotation}
                disabled={!newAnnotation.text && !audioBlob}
                className="rounded bg-white px-4 py-1.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {pinPosition && (
              <p className="mt-2 text-xs text-yellow-400">
                Pin set at ({(pinPosition.x * 100).toFixed(1)}%,{" "}
                {(pinPosition.y * 100).toFixed(1)}%)
                {getCurrentTimestamp() !== null &&
                  ` at ${formatTimestamp(getCurrentTimestamp())}`}
              </p>
            )}
          </div>

          {/* Annotations timeline */}
          <div className="mt-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">
              Annotations ({data.annotations.length})
            </h3>
            {data.annotations.length === 0 ? (
              <p className="text-sm text-zinc-600">No annotations yet</p>
            ) : (
              <div className="space-y-2">
                {data.annotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="group flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                  >
                    {ann.timestampMs !== null && (
                      <button
                        onClick={() => seekToTimestamp(ann.timestampMs!)}
                        className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
                      >
                        {formatTimestamp(ann.timestampMs)}
                      </button>
                    )}
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${typeColour(ann.type)}`}
                    >
                      {ann.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      {ann.text && (
                        <p className="text-sm text-zinc-300">{ann.text}</p>
                      )}
                      {ann.audioR2Key && (
                        <div className="mt-1">
                          {annotationAudioUrls[ann.id] ? (
                            <audio
                              controls
                              src={annotationAudioUrls[ann.id]}
                              className="h-8 w-full max-w-xs"
                            />
                          ) : (
                            <span className="text-xs text-amber-400">
                              Voice note attached (loading...)
                            </span>
                          )}
                        </div>
                      )}
                      {ann.pinX && ann.pinY && (
                        <span className="mt-1 block text-xs text-zinc-600">
                          Pinned at ({(parseFloat(ann.pinX) * 100).toFixed(0)}%,{" "}
                          {(parseFloat(ann.pinY) * 100).toFixed(0)}%)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAnnotation(ann.id)}
                      className="shrink-0 text-xs text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Fields + Actions */}
        <div className="space-y-4">
          {/* Status */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">
              Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Status
                </label>
                <select
                  value={editFields.status}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, status: e.target.value }))
                  }
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Platform
                </label>
                <select
                  value={editFields.platform}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, platform: e.target.value }))
                  }
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                >
                  {["meta", "tiktok", "instagram", "youtube", "other"].map(
                    (p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Why Saved <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={editFields.whySaved}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, whySaved: e.target.value }))
                  }
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  rows={2}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Source URL
                </label>
                <input
                  type="url"
                  value={editFields.sourceUrl}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, sourceUrl: e.target.value }))
                  }
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Advertiser
                </label>
                <input
                  type="text"
                  value={editFields.advertiserName}
                  onChange={(e) =>
                    setEditFields((f) => ({
                      ...f,
                      advertiserName: e.target.value,
                    }))
                  }
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Brand Tag
                </label>
                <input
                  type="text"
                  value={editFields.brandTag}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, brandTag: e.target.value }))
                  }
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    Format
                  </label>
                  <input
                    type="text"
                    value={editFields.format}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, format: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    Hook Type
                  </label>
                  <input
                    type="text"
                    value={editFields.hookType}
                    onChange={(e) =>
                      setEditFields((f) => ({
                        ...f,
                        hookType: e.target.value,
                      }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    Angle
                  </label>
                  <input
                    type="text"
                    value={editFields.angle}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, angle: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Notes
                </label>
                <textarea
                  value={editFields.notes}
                  onChange={(e) =>
                    setEditFields((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  rows={3}
                />
              </div>

              <button
                onClick={handleSaveFields}
                disabled={saving}
                className="w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Create Brief */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-300">
              Produced Ads
            </h3>
            {data.producedAds.length > 0 ? (
              <div className="mb-3 space-y-2">
                {data.producedAds.map((ad: any) => (
                  <Link
                    key={ad.id}
                    href={`/produced-ads/${ad.id}`}
                    className="block rounded border border-zinc-700 p-2 text-sm text-zinc-300 transition hover:border-zinc-500"
                  >
                    {ad.internalName}
                    <span className="ml-2 text-xs text-zinc-500">
                      {ad.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mb-3 text-sm text-zinc-600">
                No briefs created yet
              </p>
            )}
            <button
              onClick={() => setShowBriefModal(true)}
              className="w-full rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
            >
              Create Brief
            </button>
          </div>
        </div>
      </div>

      {/* Brief Creation Modal */}
      {showBriefModal && (
        <CreateBriefModal
          inspirationId={id}
          onClose={() => setShowBriefModal(false)}
          onCreated={() => {
            setShowBriefModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function CreateBriefModal({
  inspirationId,
  onClose,
  onCreated,
}: {
  inspirationId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    internalName: "",
    publicName: "",
    scriptUrl: "",
    editor: "",
    platform: "meta",
    campaign: "",
  });
  const [hooks, setHooks] = useState(
    Array.from({ length: 10 }, (_, i) => ({
      hookNumber: i + 1,
      hookText: "",
      creativeDirection: "",
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.internalName || !form.publicName) {
      setError("Internal name and public name are required");
      return;
    }

    // Validate at least some hooks have content
    const filledHooks = hooks.filter(
      (h) => h.hookText.trim() && h.creativeDirection.trim()
    );
    if (filledHooks.length === 0) {
      setError(
        "At least one hook variant with text and creative direction is required"
      );
      return;
    }

    setSubmitting(true);

    try {
      const adRes = await fetch("/api/produced-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          inspirationId,
        }),
      });

      if (!adRes.ok) {
        const data = await adRes.json();
        setError(data.error || "Failed to create");
        setSubmitting(false);
        return;
      }

      const ad = await adRes.json();

      // Create hooks
      await fetch(`/api/produced-ads/${ad.id}/hooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filledHooks),
      });

      // Update inspiration status to briefed
      await fetch(`/api/inspirations/${inspirationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "briefed" }),
      });

      onCreated();
    } catch {
      setError("Failed to create brief");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Create Brief / Produced Ad</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            &times;
          </button>
        </div>

        <p className="mb-4 text-xs text-zinc-500">
          Naming convention: R41&gt;Persona&gt;Stage&gt;Angle&gt;Format&gt;Hook&gt;v01
        </p>

        {error && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Internal Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.internalName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, internalName: e.target.value }))
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                placeholder="R41>QR>TOF>BreathSignal>UGC>Authority>v01"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Public Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.publicName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, publicName: e.target.value }))
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                placeholder="Vet Park Breath Signals 01"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Script URL
              </label>
              <input
                type="url"
                value={form.scriptUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scriptUrl: e.target.value }))
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Editor
              </label>
              <input
                type="text"
                value={form.editor}
                onChange={(e) =>
                  setForm((f) => ({ ...f, editor: e.target.value }))
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Platform
              </label>
              <select
                value={form.platform}
                onChange={(e) =>
                  setForm((f) => ({ ...f, platform: e.target.value }))
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              >
                {["meta", "tiktok", "instagram", "youtube", "other"].map(
                  (p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Campaign
            </label>
            <input
              type="text"
              value={form.campaign}
              onChange={(e) =>
                setForm((f) => ({ ...f, campaign: e.target.value }))
              }
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
            />
          </div>

          {/* 10 Hook Variants */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-300">
              Hook Variants (10 slots)
            </h3>
            <div className="space-y-2">
              {hooks.map((hook, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-zinc-800 text-xs text-zinc-500">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={hook.hookText}
                    onChange={(e) => {
                      const newHooks = [...hooks];
                      newHooks[idx].hookText = e.target.value;
                      setHooks(newHooks);
                    }}
                    className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                    placeholder="Hook text..."
                  />
                  <input
                    type="text"
                    value={hook.creativeDirection}
                    onChange={(e) => {
                      const newHooks = [...hooks];
                      newHooks[idx].creativeDirection = e.target.value;
                      setHooks(newHooks);
                    }}
                    className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                    placeholder="Creative direction..."
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Brief"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

async function generateVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      video.currentTime = 0.5;
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(video.src);
            resolve(blob);
          },
          "image/jpeg",
          0.8
        );
      } else resolve(null);
    };
    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(file);
  });
}
