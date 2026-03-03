"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ProducedAdWithPerf {
  id: string;
  internalName: string;
  publicName: string;
  status: string;
  platform: string | null;
  hooks: any[];
  performanceLogs: any[];
  latestPerformance: {
    spend: string | null;
    purchases: number | null;
    revenue: string | null;
    cpa: string | null;
    ctr: string | null;
    cvr: string | null;
    verdict: string;
    learning: string;
    dateStart: string | null;
    dateEnd: string | null;
  } | null;
}

export default function PerformancePage() {
  const [ads, setAds] = useState<ProducedAdWithPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"cpa" | "purchases">("cpa");

  useEffect(() => {
    fetch("/api/produced-ads")
      .then((r) => r.json())
      .then((data) => {
        setAds(data);
        setLoading(false);
      });
  }, []);

  // Filter to only ads with performance data and sort
  const adsWithPerf = ads
    .filter((a) => a.latestPerformance)
    .sort((a, b) => {
      if (sortBy === "cpa") {
        const aCpa = parseFloat(a.latestPerformance?.cpa || "999999");
        const bCpa = parseFloat(b.latestPerformance?.cpa || "999999");
        return aCpa - bCpa; // Lower CPA is better
      }
      const aPurchases = a.latestPerformance?.purchases || 0;
      const bPurchases = b.latestPerformance?.purchases || 0;
      return bPurchases - aPurchases; // Higher purchases is better
    });

  const adsWithoutPerf = ads.filter((a) => !a.latestPerformance);

  const verdictColour = (v: string) => {
    const map: Record<string, string> = {
      scale: "bg-emerald-900/40 text-emerald-300",
      iterate: "bg-amber-900/40 text-amber-300",
      kill: "bg-red-900/40 text-red-300",
    };
    return map[v] || "bg-zinc-800 text-zinc-400";
  };

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Performance Leaderboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy("cpa")}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              sortBy === "cpa"
                ? "bg-white text-black"
                : "border border-zinc-700 text-zinc-400 hover:text-white"
            }`}
          >
            Sort by CPA
          </button>
          <button
            onClick={() => setSortBy("purchases")}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              sortBy === "purchases"
                ? "bg-white text-black"
                : "border border-zinc-700 text-zinc-400 hover:text-white"
            }`}
          >
            Sort by Purchases
          </button>
        </div>
      </div>

      {adsWithPerf.length === 0 && adsWithoutPerf.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">
          No produced ads yet. Create briefs from inspirations first.
        </div>
      ) : (
        <>
          {/* Leaderboard table */}
          {adsWithPerf.length > 0 && (
            <div className="mb-8 overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                      Ad
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                      Spend
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                      Purchases
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                      CPA
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                      CTR
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500">
                      Verdict
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                      Learning
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {adsWithPerf.map((ad, idx) => {
                    const p = ad.latestPerformance!;
                    return (
                      <tr
                        key={ad.id}
                        className="border-b border-zinc-800/50 transition hover:bg-zinc-900/50"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                              idx === 0
                                ? "bg-yellow-600 text-white"
                                : idx === 1
                                ? "bg-zinc-400 text-black"
                                : idx === 2
                                ? "bg-amber-700 text-white"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/produced-ads/${ad.id}`}
                            className="text-sm font-medium text-zinc-200 transition hover:text-white"
                          >
                            {ad.internalName}
                          </Link>
                          <p className="text-xs text-zinc-500">{ad.publicName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusColour(ad.status)}`}
                          >
                            {ad.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-300">
                          {p.spend ? `$${p.spend}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-300">
                          {p.purchases ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-300">
                          {p.revenue ? `$${p.revenue}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-zinc-200">
                          {p.cpa ? `$${p.cpa}` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-zinc-300">
                          {p.ctr ? `${p.ctr}%` : "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${verdictColour(p.verdict)}`}
                          >
                            {p.verdict}
                          </span>
                        </td>
                        <td className="max-w-[200px] px-4 py-3">
                          <p className="truncate text-xs text-zinc-400">
                            {p.learning}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Ads without performance data */}
          {adsWithoutPerf.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-zinc-500">
                Awaiting Performance Data ({adsWithoutPerf.length})
              </h2>
              <div className="space-y-2">
                {adsWithoutPerf.map((ad) => (
                  <Link
                    key={ad.id}
                    href={`/produced-ads/${ad.id}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition hover:border-zinc-600"
                  >
                    <div>
                      <span className="text-sm text-zinc-300">
                        {ad.internalName}
                      </span>
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${statusColour(ad.status)}`}
                      >
                        {ad.status.replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-600">
                      Add performance data &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
