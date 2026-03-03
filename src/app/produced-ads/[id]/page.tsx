"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface HookData {
  id: string;
  hookNumber: number;
  hookText: string;
  creativeDirection: string;
}

interface PerfLogData {
  id: string;
  dateStart: string | null;
  dateEnd: string | null;
  spend: string | null;
  purchases: number | null;
  revenue: string | null;
  cpa: string | null;
  ctr: string | null;
  cvr: string | null;
  verdict: string;
  learning: string;
  createdAt: string;
}

interface ProducedAdDetail {
  id: string;
  inspirationId: string;
  internalName: string;
  publicName: string;
  scriptUrl: string | null;
  editor: string | null;
  status: string;
  platform: string | null;
  liveDate: string | null;
  campaign: string | null;
  hooks: HookData[];
  performanceLogs: PerfLogData[];
}

const STATUS_OPTIONS = ["in_production", "live", "killed"];

export default function ProducedAdDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ProducedAdDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // New hook
  const [newHook, setNewHook] = useState({ hookText: "", creativeDirection: "" });

  // Performance log
  const [showPerfModal, setShowPerfModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/produced-ads/${id}`);
    const d = await res.json();
    setData(d);
    setEditFields({
      internalName: d.internalName || "",
      publicName: d.publicName || "",
      scriptUrl: d.scriptUrl || "",
      editor: d.editor || "",
      status: d.status || "in_production",
      platform: d.platform || "",
      liveDate: d.liveDate || "",
      campaign: d.campaign || "",
    });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/produced-ads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editFields),
    });
    setSaving(false);
    fetchData();
  };

  const handleAddHook = async () => {
    if (!newHook.hookText || !newHook.creativeDirection) return;
    const nextNum = (data?.hooks.length || 0) + 1;
    await fetch(`/api/produced-ads/${id}/hooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hookNumber: nextNum,
        hookText: newHook.hookText,
        creativeDirection: newHook.creativeDirection,
      }),
    });
    setNewHook({ hookText: "", creativeDirection: "" });
    fetchData();
  };

  const handleDeleteHook = async (hookId: string) => {
    await fetch(`/api/hooks/${hookId}`, { method: "DELETE" });
    fetchData();
  };

  const handleUpdateHook = async (
    hookId: string,
    field: string,
    value: string
  ) => {
    await fetch(`/api/hooks/${hookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  };

  const verdictColour = (v: string) => {
    const map: Record<string, string> = {
      scale: "bg-emerald-900/40 text-emerald-300",
      iterate: "bg-amber-900/40 text-amber-300",
      kill: "bg-red-900/40 text-red-300",
    };
    return map[v] || "bg-zinc-800 text-zinc-400";
  };

  if (loading || !data) {
    return <div className="py-20 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/produced-ads"
          className="text-zinc-500 transition hover:text-white"
        >
          &larr; Briefs
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-300">{data.internalName}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-4 text-lg font-bold">Brief Details</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    Internal Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFields.internalName}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, internalName: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    Public Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFields.publicName}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, publicName: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Status</label>
                  <select
                    value={editFields.status}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, status: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ").charAt(0).toUpperCase() +
                          s.replace("_", " ").slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Editor</label>
                  <input
                    type="text"
                    value={editFields.editor}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, editor: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Platform</label>
                  <select
                    value={editFields.platform}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, platform: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  >
                    <option value="">Select...</option>
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Script URL</label>
                  <input
                    type="url"
                    value={editFields.scriptUrl}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, scriptUrl: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Live Date</label>
                  <input
                    type="date"
                    value={editFields.liveDate}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, liveDate: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Campaign</label>
                  <input
                    type="text"
                    value={editFields.campaign}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, campaign: e.target.value }))
                    }
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <Link
                  href={`/inspiration/${data.inspirationId}`}
                  className="text-sm text-zinc-500 transition hover:text-white"
                >
                  View Inspiration &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Hook Variants */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-4 text-lg font-bold">
              Hook Variants ({data.hooks.length}/10)
            </h2>
            <div className="space-y-2">
              {data.hooks.map((hook) => (
                <div
                  key={hook.id}
                  className="group flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-800 text-xs text-zinc-500">
                    {hook.hookNumber}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <EditableText
                      value={hook.hookText}
                      placeholder="Hook text..."
                      onSave={(val) => handleUpdateHook(hook.id, "hookText", val)}
                      className="text-sm font-medium text-zinc-200"
                    />
                    <EditableText
                      value={hook.creativeDirection}
                      placeholder="Creative direction..."
                      onSave={(val) =>
                        handleUpdateHook(hook.id, "creativeDirection", val)
                      }
                      className="text-xs text-zinc-400"
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteHook(hook.id)}
                    className="shrink-0 text-xs text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              ))}

              {data.hooks.length < 10 && (
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={newHook.hookText}
                    onChange={(e) =>
                      setNewHook((h) => ({ ...h, hookText: e.target.value }))
                    }
                    className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                    placeholder="New hook text..."
                  />
                  <input
                    type="text"
                    value={newHook.creativeDirection}
                    onChange={(e) =>
                      setNewHook((h) => ({
                        ...h,
                        creativeDirection: e.target.value,
                      }))
                    }
                    className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
                    placeholder="Creative direction..."
                  />
                  <button
                    onClick={handleAddHook}
                    className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-zinc-600"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Performance Logs */}
        <div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Performance Logs</h2>
              <button
                onClick={() => setShowPerfModal(true)}
                className="rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition hover:bg-zinc-600"
              >
                + Add Entry
              </button>
            </div>

            {data.performanceLogs.length === 0 ? (
              <p className="text-sm text-zinc-600">No performance data yet</p>
            ) : (
              <div className="space-y-3">
                {data.performanceLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">
                        {log.dateStart} to {log.dateEnd}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${verdictColour(log.verdict)}`}
                      >
                        {log.verdict}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {log.spend && (
                        <div>
                          <span className="text-zinc-500">Spend: </span>
                          <span className="text-zinc-300">${log.spend}</span>
                        </div>
                      )}
                      {log.purchases !== null && (
                        <div>
                          <span className="text-zinc-500">Purchases: </span>
                          <span className="text-zinc-300">{log.purchases}</span>
                        </div>
                      )}
                      {log.revenue && (
                        <div>
                          <span className="text-zinc-500">Revenue: </span>
                          <span className="text-zinc-300">${log.revenue}</span>
                        </div>
                      )}
                      {log.cpa && (
                        <div>
                          <span className="text-zinc-500">CPA: </span>
                          <span className="text-zinc-300">${log.cpa}</span>
                        </div>
                      )}
                      {log.ctr && (
                        <div>
                          <span className="text-zinc-500">CTR: </span>
                          <span className="text-zinc-300">{log.ctr}%</span>
                        </div>
                      )}
                      {log.cvr && (
                        <div>
                          <span className="text-zinc-500">CVR: </span>
                          <span className="text-zinc-300">{log.cvr}%</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 border-t border-zinc-800 pt-2">
                      <span className="text-xs text-zinc-500">Learning: </span>
                      <span className="text-xs text-zinc-300">{log.learning}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Log Modal */}
      {showPerfModal && (
        <PerformanceLogModal
          producedAdId={id}
          onClose={() => setShowPerfModal(false)}
          onCreated={() => {
            setShowPerfModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function EditableText({
  value,
  placeholder,
  onSave,
  className,
}: {
  value: string;
  placeholder: string;
  onSave: (val: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  const handleBlur = () => {
    setEditing(false);
    if (val !== value) onSave(val);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === "Enter" && handleBlur()}
        className={`w-full rounded border border-zinc-600 bg-zinc-800 px-1 py-0.5 ${className}`}
      />
    );
  }

  return (
    <p
      onClick={() => {
        setVal(value);
        setEditing(true);
      }}
      className={`cursor-pointer rounded px-1 transition hover:bg-zinc-800 ${className}`}
    >
      {value || <span className="text-zinc-600">{placeholder}</span>}
    </p>
  );
}

function PerformanceLogModal({
  producedAdId,
  onClose,
  onCreated,
}: {
  producedAdId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    dateStart: "",
    dateEnd: "",
    spend: "",
    purchases: "",
    revenue: "",
    cpa: "",
    ctr: "",
    cvr: "",
    verdict: "",
    learning: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.verdict) {
      setError("Verdict is required");
      return;
    }
    if (!form.learning.trim()) {
      setError("Learning is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/performance-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producedAdId,
          dateStart: form.dateStart || null,
          dateEnd: form.dateEnd || null,
          spend: form.spend || null,
          purchases: form.purchases ? parseInt(form.purchases) : null,
          revenue: form.revenue || null,
          cpa: form.cpa || null,
          ctr: form.ctr || null,
          cvr: form.cvr || null,
          verdict: form.verdict,
          learning: form.learning,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create");
        setSubmitting(false);
        return;
      }

      onCreated();
    } catch (err) {
      setError("Failed to create performance log");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add Performance Entry</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Date Start</label>
              <input
                type="date"
                value={form.dateStart}
                onChange={(e) => setForm((f) => ({ ...f, dateStart: e.target.value }))}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Date End</label>
              <input
                type="date"
                value={form.dateEnd}
                onChange={(e) => setForm((f) => ({ ...f, dateEnd: e.target.value }))}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Spend ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.spend}
                onChange={(e) => setForm((f) => ({ ...f, spend: e.target.value }))}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Purchases</label>
              <input
                type="number"
                value={form.purchases}
                onChange={(e) =>
                  setForm((f) => ({ ...f, purchases: e.target.value }))
                }
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Revenue ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.revenue}
                onChange={(e) => setForm((f) => ({ ...f, revenue: e.target.value }))}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">CPA ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.cpa}
                onChange={(e) => setForm((f) => ({ ...f, cpa: e.target.value }))}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">CTR (%)</label>
              <input
                type="number"
                step="0.0001"
                value={form.ctr}
                onChange={(e) => setForm((f) => ({ ...f, ctr: e.target.value }))}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">CVR (%)</label>
              <input
                type="number"
                step="0.0001"
                value={form.cvr}
                onChange={(e) => setForm((f) => ({ ...f, cvr: e.target.value }))}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Verdict <span className="text-red-400">*</span>
            </label>
            <select
              value={form.verdict}
              onChange={(e) => setForm((f) => ({ ...f, verdict: e.target.value }))}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
            >
              <option value="">Select verdict...</option>
              <option value="scale">Scale</option>
              <option value="iterate">Iterate</option>
              <option value="kill">Kill</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Learning <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.learning}
              onChange={(e) => setForm((f) => ({ ...f, learning: e.target.value }))}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200"
              rows={3}
              placeholder="What did you learn from this ad's performance?"
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
              {submitting ? "Saving..." : "Add Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
