"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface InspirationItem {
  id: string;
  platform: string;
  advertiserName: string | null;
  whySaved: string;
  triage: string | null;
  status: string;
  hookType: string | null;
  format: string | null;
  angle: string | null;
  createdAt: string;
  assets: any[];
  annotationCount: number;
}

export default function InboxTriagePage() {
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/inspirations?status=inbox");
    const data = await res.json();
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, items.length - 1));
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === "t" && items[selectedIdx]) {
        handleTriage(items[selectedIdx].id, "test");
      }
      if (e.key === "m" && items[selectedIdx]) {
        handleTriage(items[selectedIdx].id, "maybe");
      }
      if (e.key === "a" && items[selectedIdx]) {
        handleTriage(items[selectedIdx].id, "archive");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items, selectedIdx]);

  const handleTriage = async (id: string, triage: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (!item.whySaved || item.whySaved.trim() === "") {
      alert("Why saved is required before triaging");
      return;
    }

    if (triage === "test" && !item.hookType && !item.format && !item.angle) {
      alert("When triage is Test, at least one of hook type, format, or angle is required");
      return;
    }

    setSaving(id);
    await fetch(`/api/inspirations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triage,
        status: triage === "archive" ? "archived" : "shortlisted",
      }),
    });
    setSaving(null);
    fetchInbox();
  };

  const handleUpdateField = async (
    id: string,
    field: string,
    value: string
  ) => {
    await fetch(`/api/inspirations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  };

  if (loading) {
    return <div className="py-20 text-center text-zinc-500">Loading inbox...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inbox Triage</h1>
        <div className="text-sm text-zinc-500">
          {items.length} items in inbox &middot; Keys: <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">j/k</kbd> navigate, <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">t</kbd> test, <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">m</kbd> maybe, <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">a</kbd> archive
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">
          Inbox is empty. All caught up!
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition ${
                idx === selectedIdx
                  ? "border-white/30 bg-zinc-800/80"
                  : "border-zinc-800 bg-zinc-900"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                      {item.platform}
                    </span>
                    {item.advertiserName && (
                      <span className="text-sm text-zinc-400">
                        {item.advertiserName}
                      </span>
                    )}
                    <span className="text-xs text-zinc-600">
                      {new Date(item.createdAt).toLocaleDateString("en-AU")}
                    </span>
                  </div>

                  <InlineEditField
                    value={item.whySaved}
                    placeholder="Why saved (required)..."
                    required
                    onSave={(val) => handleUpdateField(item.id, "whySaved", val)}
                  />

                  <div className="mt-2 flex gap-2">
                    <InlineEditField
                      value={item.hookType || ""}
                      placeholder="Hook type"
                      small
                      onSave={(val) => handleUpdateField(item.id, "hookType", val)}
                    />
                    <InlineEditField
                      value={item.format || ""}
                      placeholder="Format"
                      small
                      onSave={(val) => handleUpdateField(item.id, "format", val)}
                    />
                    <InlineEditField
                      value={item.angle || ""}
                      placeholder="Angle"
                      small
                      onSave={(val) => handleUpdateField(item.id, "angle", val)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/inspiration/${item.id}`}
                    className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleTriage(item.id, "test")}
                    disabled={saving === item.id}
                    className="rounded bg-emerald-900/50 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-800/50"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleTriage(item.id, "maybe")}
                    disabled={saving === item.id}
                    className="rounded bg-amber-900/50 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-800/50"
                  >
                    Maybe
                  </button>
                  <button
                    onClick={() => handleTriage(item.id, "archive")}
                    disabled={saving === item.id}
                    className="rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700"
                  >
                    Archive
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineEditField({
  value,
  placeholder,
  required,
  small,
  onSave,
}: {
  value: string;
  placeholder: string;
  required?: boolean;
  small?: boolean;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  const handleBlur = () => {
    setEditing(false);
    if (val !== value) {
      onSave(val);
    }
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
        className={`rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-zinc-200 ${
          small ? "text-xs" : "text-sm"
        }`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      onClick={() => {
        setVal(value);
        setEditing(true);
      }}
      className={`cursor-pointer rounded px-1 transition hover:bg-zinc-800 ${
        small ? "text-xs text-zinc-500" : "text-sm text-zinc-300"
      } ${!value && required ? "text-red-400" : ""}`}
    >
      {value || placeholder}
    </span>
  );
}
