"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface InspirationItem {
  id: string;
  platform: string;
  advertiserName: string | null;
  brandTag: string | null;
  format: string | null;
  hookType: string | null;
  angle: string | null;
  triage: string | null;
  status: string;
  whySaved: string;
  createdAt: string;
  assets: {
    id: string;
    type: string;
    thumbnailR2Key: string | null;
  }[];
  annotationCount: number;
}

const STATUSES = ["inbox", "shortlisted", "annotated", "briefed", "archived"];
const TRIAGES = ["test", "maybe", "archive"];
const PLATFORMS = ["meta", "tiktok", "instagram", "youtube", "other"];

export default function InspirationBoard() {
  const [inspirations, setInspirations] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    triage: "",
    platform: "",
    format: "",
    hookType: "",
    angle: "",
    search: "",
  });
  const [sort, setSort] = useState("newest");
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [showNewModal, setShowNewModal] = useState(false);
  const [weeklyCount, setWeeklyCount] = useState({
    count: 0,
    cap: 15,
    isOverCap: false,
  });

  const fetchInspirations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.triage) params.set("triage", filters.triage);
    if (filters.platform) params.set("platform", filters.platform);
    if (filters.search) params.set("search", filters.search);
    params.set("sort", sort);

    const res = await fetch(`/api/inspirations?${params}`);
    const data = await res.json();

    // Client-side filter for format, hookType, angle (not in API query params)
    let filtered = data;
    if (filters.format) {
      filtered = filtered.filter(
        (i: InspirationItem) =>
          i.format?.toLowerCase() === filters.format.toLowerCase()
      );
    }
    if (filters.hookType) {
      filtered = filtered.filter(
        (i: InspirationItem) =>
          i.hookType?.toLowerCase() === filters.hookType.toLowerCase()
      );
    }
    if (filters.angle) {
      filtered = filtered.filter(
        (i: InspirationItem) =>
          i.angle?.toLowerCase() === filters.angle.toLowerCase()
      );
    }

    // Client-side sort
    if (sort === "most_annotated") {
      filtered.sort(
        (a: InspirationItem, b: InspirationItem) =>
          b.annotationCount - a.annotationCount
      );
    }

    setInspirations(filtered);
    setLoading(false);

    // Fetch thumbnails for assets
    for (const inspo of filtered) {
      if (inspo.assets?.length > 0) {
        const asset = inspo.assets[0];
        if (asset.thumbnailR2Key) {
          try {
            const urlRes = await fetch(`/api/assets/${asset.id}/signed-url`);
            const urlData = await urlRes.json();
            if (urlData.thumbnailUrl) {
              setThumbnails((prev) => ({
                ...prev,
                [inspo.id]: urlData.thumbnailUrl,
              }));
            }
          } catch {
            // skip failed thumbnail fetches
          }
        }
      }
    }
  }, [filters, sort]);

  useEffect(() => {
    fetchInspirations();
  }, [fetchInspirations]);

  useEffect(() => {
    fetch("/api/inspirations/weekly-count")
      .then((r) => r.json())
      .then(setWeeklyCount)
      .catch(() => {});
  }, []);

  // Collect unique values for filter dropdowns
  const uniqueFormats = [
    ...new Set(inspirations.map((i) => i.format).filter(Boolean)),
  ] as string[];
  const uniqueHookTypes = [
    ...new Set(inspirations.map((i) => i.hookType).filter(Boolean)),
  ] as string[];
  const uniqueAngles = [
    ...new Set(inspirations.map((i) => i.angle).filter(Boolean)),
  ] as string[];

  const statusColour = (s: string) => {
    const map: Record<string, string> = {
      inbox: "bg-yellow-900/40 text-yellow-300",
      shortlisted: "bg-blue-900/40 text-blue-300",
      annotated: "bg-purple-900/40 text-purple-300",
      briefed: "bg-green-900/40 text-green-300",
      archived: "bg-zinc-800 text-zinc-400",
    };
    return map[s] || "bg-zinc-800 text-zinc-400";
  };

  const triageColour = (t: string | null) => {
    if (!t) return "bg-zinc-800 text-zinc-500";
    const map: Record<string, string> = {
      test: "bg-emerald-900/40 text-emerald-300",
      maybe: "bg-amber-900/40 text-amber-300",
      archive: "bg-zinc-800 text-zinc-400",
    };
    return map[t] || "bg-zinc-800 text-zinc-400";
  };

  return (
    <div>
      {weeklyCount.isOverCap && (
        <div className="mb-4 rounded-lg border border-amber-700 bg-amber-900/30 px-4 py-3 text-amber-200">
          Weekly save cap reached: {weeklyCount.count}/{weeklyCount.cap}{" "}
          inspirations saved this week. Consider being more selective.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Inspiration Board</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
        >
          + New Inspiration
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={filters.triage}
          onChange={(e) =>
            setFilters((f) => ({ ...f, triage: e.target.value }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">All Triage</option>
          {TRIAGES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={filters.platform}
          onChange={(e) =>
            setFilters((f) => ({ ...f, platform: e.target.value }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={filters.format}
          onChange={(e) =>
            setFilters((f) => ({ ...f, format: e.target.value }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">All Formats</option>
          {uniqueFormats.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <select
          value={filters.hookType}
          onChange={(e) =>
            setFilters((f) => ({ ...f, hookType: e.target.value }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">All Hook Types</option>
          {uniqueHookTypes.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <select
          value={filters.angle}
          onChange={(e) =>
            setFilters((f) => ({ ...f, angle: e.target.value }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="">All Angles</option>
          {uniqueAngles.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value }))
          }
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500"
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          <option value="newest">Newest</option>
          <option value="most_annotated">Most Annotated</option>
          <option value="recently_used">Recently Used</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center text-zinc-500">Loading...</div>
      ) : inspirations.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">
          No inspirations found. Create your first one!
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {inspirations.map((inspo) => (
            <Link
              key={inspo.id}
              href={`/inspiration/${inspo.id}`}
              className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 transition hover:border-zinc-600"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video w-full bg-zinc-800">
                {thumbnails[inspo.id] ? (
                  <img
                    src={thumbnails[inspo.id]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-600">
                    {inspo.assets?.length > 0 ? (
                      <svg
                        className="h-10 w-10"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-10 w-10"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                        />
                      </svg>
                    )}
                  </div>
                )}
                {inspo.assets?.[0]?.type === "video" && (
                  <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                    Video
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColour(inspo.status)}`}
                  >
                    {inspo.status}
                  </span>
                  {inspo.triage && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${triageColour(inspo.triage)}`}
                    >
                      {inspo.triage}
                    </span>
                  )}
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                    {inspo.platform}
                  </span>
                </div>
                <p className="mb-1 line-clamp-2 text-sm text-zinc-300">
                  {inspo.whySaved}
                </p>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  {inspo.advertiserName && <span>{inspo.advertiserName}</span>}
                  <span>{inspo.annotationCount} annotations</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Inspiration Modal */}
      {showNewModal && (
        <NewInspirationModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            fetchInspirations();
          }}
        />
      )}
    </div>
  );
}

function NewInspirationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    platform: "other",
    sourceUrl: "",
    advertiserName: "",
    brandTag: "",
    format: "",
    hookType: "",
    angle: "",
    triage: "",
    whySaved: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.whySaved.trim()) {
      setError("Why saved is required");
      return;
    }

    if (!form.triage) {
      setError("Triage is required");
      return;
    }

    if (
      form.triage === "test" &&
      !form.hookType &&
      !form.format &&
      !form.angle
    ) {
      setError(
        "When triage is Test, at least one of hook type, format, or angle is required"
      );
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/inspirations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          triage: form.triage || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create");
        setSubmitting(false);
        return;
      }

      const inspo = await res.json();

      // Upload file if provided
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("inspirationId", inspo.id);

        // Generate thumbnail client-side for videos
        if (file.type.startsWith("video/")) {
          try {
            const thumbBlob = await generateVideoThumbnail(file);
            if (thumbBlob) {
              fd.append("thumbnail", thumbBlob, "thumb.jpg");
            }
          } catch (e) {
            console.error("Thumbnail generation failed:", e);
          }
        }

        await fetch("/api/assets/upload", {
          method: "POST",
          body: fd,
        });
      }

      onCreated();
    } catch {
      setError("Failed to create inspiration");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">New Inspiration</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Why Saved <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.whySaved}
              onChange={(e) =>
                setForm((f) => ({ ...f, whySaved: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
              placeholder="One line: why is this worth saving?"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Triage <span className="text-red-400">*</span>
            </label>
            <select
              value={form.triage}
              onChange={(e) =>
                setForm((f) => ({ ...f, triage: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
            >
              <option value="">Select triage...</option>
              <option value="test">Test</option>
              <option value="maybe">Maybe</option>
              <option value="archive">Archive</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Platform
              </label>
              <select
                value={form.platform}
                onChange={(e) =>
                  setForm((f) => ({ ...f, platform: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Source URL
              </label>
              <input
                type="url"
                value={form.sourceUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sourceUrl: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Advertiser
              </label>
              <input
                type="text"
                value={form.advertiserName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, advertiserName: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Brand Tag
              </label>
              <input
                type="text"
                value={form.brandTag}
                onChange={(e) =>
                  setForm((f) => ({ ...f, brandTag: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Format
              </label>
              <input
                type="text"
                value={form.format}
                onChange={(e) =>
                  setForm((f) => ({ ...f, format: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                placeholder="e.g. UGC"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Hook Type
              </label>
              <input
                type="text"
                value={form.hookType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hookType: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                placeholder="e.g. Authority"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Angle
              </label>
              <input
                type="text"
                value={form.angle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, angle: e.target.value }))
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
                placeholder="e.g. BreathSignal"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Upload Asset (video or image)
            </label>
            <input
              type="file"
              accept="video/webm,video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-zinc-400 file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-sm file:text-zinc-200"
            />
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
              {submitting ? "Saving..." : "Save Inspiration"}
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
      } else {
        resolve(null);
      }
    };

    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(file);
  });
}
