"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ProducedAdItem {
  id: string;
  internalName: string;
  publicName: string;
  status: string;
  platform: string | null;
  editor: string | null;
  campaign: string | null;
  liveDate: string | null;
  inspirationId: string;
  hooks: any[];
  latestPerformance: any;
  createdAt: string;
}

export default function ProducedAdsPage() {
  const [ads, setAds] = useState<ProducedAdItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/produced-ads")
      .then((r) => r.json())
      .then((data) => {
        setAds(data);
        setLoading(false);
      });
  }, []);

  const statusColour = (s: string) => {
    const map: Record<string, string> = {
      in_production: "bg-blue-900/40 text-blue-300",
      live: "bg-green-900/40 text-green-300",
      killed: "bg-red-900/40 text-red-300",
    };
    return map[s] || "bg-zinc-800 text-zinc-400";
  };

  if (loading) {
    return <div className="py-20 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Briefs / Produced Ads</h1>

      {ads.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">
          No produced ads yet. Create a brief from an inspiration.
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <Link
              key={ad.id}
              href={`/produced-ads/${ad.id}`}
              className="block rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="font-medium text-zinc-200">
                      {ad.internalName}
                    </h3>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColour(ad.status)}`}
                    >
                      {ad.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">{ad.publicName}</p>
                  <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                    {ad.platform && <span>Platform: {ad.platform}</span>}
                    {ad.editor && <span>Editor: {ad.editor}</span>}
                    {ad.campaign && <span>Campaign: {ad.campaign}</span>}
                    <span>{ad.hooks.length} hooks</span>
                  </div>
                </div>
                <div className="text-right">
                  {ad.latestPerformance && (
                    <div className="text-sm">
                      <span className="text-zinc-400">CPA: </span>
                      <span className="text-zinc-200">
                        ${ad.latestPerformance.cpa || "N/A"}
                      </span>
                    </div>
                  )}
                  <span className="text-xs text-zinc-600">
                    {new Date(ad.createdAt).toLocaleDateString("en-AU")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
