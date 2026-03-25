"use client";

import { useState } from "react";
import type { GarmentListItem } from "@/lib/domain/wardrobe/service";
import type { StyleRuleListItem } from "@/lib/domain/style-rules/service";
import type { UserTrendMatchWithSignal } from "@/lib/domain/trends";
import type { GeneratedOutfit, OutfitGarmentPreview } from "@/lib/domain/outfits";
import {
  generateOutfitAction,
  getSwapCandidatesAction,
  saveOutfitAction
} from "@/app/outfits/actions";

type Tab = "plan" | "surprise" | "trend";

interface OutfitGeneratorProps {
  isPro: boolean;
  garments: GarmentListItem[];
  styleRules: StyleRuleListItem[];
  trendSignals: UserTrendMatchWithSignal[];
  initialMode?: "plan" | "surprise" | "trend";
  initialItemId?: string;
}

export function OutfitGenerator({
  isPro,
  garments,
  styleRules,
  trendSignals,
  initialMode,
  initialItemId: _initialItemId // TODO: pre-lock garment from initialItemId
}: OutfitGeneratorProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialMode ?? "plan");
  const [pendingResult, setPendingResult] = useState<GeneratedOutfit | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Plan it form state
  const [occasion, setOccasion] = useState("");
  const [dressCode, setDressCode] = useState("");
  const [weather, setWeather] = useState("");

  // Trend form state
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  const DRESS_CODE_OPTIONS = ["Any", "Casual", "Smart casual", "Business casual", "Formal", "Black tie"];
  const WEATHER_OPTIONS = ["Any", "Warm sun", "Cool breeze", "Cold rain", "Mild clear"];
  const DRESS_CODE_VALUES: Record<string, string> = {
    "Any": "", "Casual": "casual", "Smart casual": "smart_casual",
    "Business casual": "business_casual", "Formal": "formal", "Black tie": "black_tie"
  };
  const WEATHER_VALUES: Record<string, string> = {
    "Any": "", "Warm sun": "warm_sun", "Cool breeze": "cool_breeze",
    "Cold rain": "cold_rain", "Mild clear": "mild_clear"
  };

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setPendingResult(null);

    let input: unknown;
    if (activeTab === "plan") {
      input = {
        mode: "plan",
        occasion: occasion || null,
        dress_code: DRESS_CODE_VALUES[dressCode] || null,
        weather: WEATHER_VALUES[weather] || null
      };
    } else if (activeTab === "surprise") {
      input = { mode: "surprise" };
    } else {
      if (!selectedSignalId) { setError("Select a trend signal first."); setIsGenerating(false); return; }
      input = { mode: "trend", trend_signal_id: selectedSignalId };
    }

    const result = await generateOutfitAction(input);
    if ("error" in result) {
      setError(result.error);
    } else {
      setPendingResult(result.outfit);
    }
    setIsGenerating(false);
  }

  async function handleSave() {
    if (!pendingResult) return;
    let title = "";
    let occasion_val: string | null = null;
    let dress_code_val: string | null = null;
    let weather_ctx: Record<string, unknown> = {};

    if (activeTab === "plan") {
      title = [occasion, dressCode].filter(Boolean).join(", ") || "Outfit";
      occasion_val = occasion || null;
      dress_code_val = DRESS_CODE_VALUES[dressCode] || null;
      if (weather) weather_ctx = { weather: WEATHER_VALUES[weather] };
    } else if (activeTab === "surprise") {
      title = `Outfit — ${new Date().toLocaleDateString()}`;
    } else {
      const signal = trendSignals.find(s => s.trend_signal_id === selectedSignalId);
      title = signal?.trend_signal.label ?? "Trend outfit";
    }

    const result = await saveOutfitAction({
      title,
      occasion: occasion_val,
      dress_code: dress_code_val,
      weather_context_json: weather_ctx,
      explanation: pendingResult.explanation,
      explanation_json: { rules: pendingResult.firedRules },
      garments: pendingResult.garments.map(g => ({ garment_id: g.id, role: g.role }))
    });

    if ("error" in result) {
      setError(result.error);
    } else {
      setPendingResult(null);
      setOccasion(""); setDressCode(""); setWeather(""); setSelectedSignalId(null);
    }
  }

  const MATCH_TYPE_LABEL: Record<string, string> = {
    exact_match: "exact match",
    adjacent_match: "adjacent",
    styling_match: "adjacent",
    missing_piece: "missing piece"
  };

  return (
    <div className="rounded-[1.75rem] border border-[var(--line)] bg-white overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 px-5 pt-4 pb-0 border-b border-[var(--line)]">
        {(["plan", "surprise", "trend"] as Tab[]).map(tab => {
          const labels = { plan: "Plan it", surprise: "Surprise Me", trend: "Trend" };
          const isLocked = !isPro && tab !== "plan";
          return (
            <button
              key={tab}
              onClick={() => !isLocked && setActiveTab(tab)}
              className={`
                px-3.5 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors
                ${activeTab === tab
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)]"}
                ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:text-[var(--foreground)]"}
              `}
            >
              {labels[tab]}
              {isLocked && (
                <span className="ml-1.5 text-[9px] font-semibold tracking-wide bg-[#e8e0d0] text-[#a08050] px-1.5 py-0.5 rounded">
                  PRO
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto pb-2 text-[10px] text-[var(--muted)]">
          {isPro ? "Pro" : "Free tier"}
        </div>
      </div>

      {/* Form panels */}
      <div className="p-5">
        {activeTab === "plan" && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-1.5">Occasion</label>
              <input
                type="text"
                value={occasion}
                onChange={e => setOccasion(e.target.value)}
                placeholder="dinner, work…"
                className="w-full h-9 rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-1.5">Dress Code</label>
              <select
                value={dressCode}
                onChange={e => setDressCode(e.target.value)}
                className="w-full h-9 rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 text-sm text-[var(--foreground)]"
              >
                {DRESS_CODE_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-1.5">Weather</label>
              <select
                value={weather}
                onChange={e => setWeather(e.target.value)}
                className="w-full h-9 rounded-lg bg-[var(--surface)] border border-[var(--line)] px-3 text-sm text-[var(--foreground)]"
              >
                {WEATHER_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeTab === "surprise" && (
          <div className="text-center py-6">
            <div className="text-2xl mb-2">✦</div>
            <p className="text-sm font-semibold text-[var(--foreground)] mb-1">Surprise me</p>
            <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
              Pick a complete outfit from your wardrobe using your style rules — no input needed.
            </p>
          </div>
        )}

        {activeTab === "trend" && (
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mb-2">Pick a trend signal</p>
            {trendSignals.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No active trend signals yet — visit the Trends page to run a match.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {trendSignals.map(match => (
                  <button
                    key={match.trend_signal_id}
                    onClick={() => setSelectedSignalId(match.trend_signal_id)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
                      ${selectedSignalId === match.trend_signal_id
                        ? "border-[var(--foreground)] bg-[var(--surface)]"
                        : "border-[var(--line)] bg-white hover:bg-[var(--surface)]"}
                    `}
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        selectedSignalId === match.trend_signal_id
                          ? "bg-[var(--foreground)]"
                          : "bg-[var(--line)]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                        {match.trend_signal.label}
                      </p>
                      <p className="text-[10px] text-[var(--muted)] mt-0.5">
                        {match.trend_signal.trend_type}
                        {match.trend_signal.season ? ` · ${match.trend_signal.season}` : ""}
                        {match.trend_signal.year ? ` ${match.trend_signal.year}` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] text-[var(--muted)] bg-[var(--surface)] px-1.5 py-0.5 rounded flex-shrink-0">
                      {MATCH_TYPE_LABEL[match.match_type] ?? match.match_type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full h-10 bg-[var(--foreground)] text-white rounded-xl text-sm font-medium disabled:opacity-60"
        >
          {isGenerating
            ? "Generating…"
            : activeTab === "trend"
            ? "Generate outfit around this trend"
            : "Generate outfit"}
        </button>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </div>

      {/* Result panel */}
      {pendingResult && (
        <div className="border-t border-[var(--line)] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">Generated outfit</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingResult(null)}
                className="px-3 py-1.5 text-xs border border-[var(--line)] rounded-lg text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-xs bg-[var(--foreground)] text-white rounded-lg"
              >
                Save outfit
              </button>
            </div>
          </div>

          {/* Garment chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {pendingResult.garments.map(g => (
              <SwapChip
                key={g.id}
                garment={g}
                onSwap={(newGarment) => {
                  // Replace the swapped garment, then re-run the rules engine
                  // client-side using the in-memory garments + styleRules props.
                  // No server round-trip. No Claude call — always shows rule tags after swap.
                  const updatedGarments = pendingResult.garments.map(
                    x => x.id === g.id ? { ...newGarment, role: g.role } : x
                  );
                  // Re-collect fired rules for the new garment set
                  const newFiredRules = updatedGarments.flatMap(ug => {
                    const fullGarment = garments.find(wg => wg.id === ug.id);
                    if (!fullGarment) return [];
                    return styleRules
                      .filter(r => {
                        const ruleWithType = r as StyleRuleListItem & { constraint_type?: string };
                        return ruleWithType.constraint_type === "soft" && r.active &&
                          fullGarment.category.toLowerCase().includes(r.subject_value.toLowerCase());
                      })
                      .map(r => ({ description: r.explanation || r.predicate, garment_ids: [ug.id] }));
                  });
                  setPendingResult({
                    garments: updatedGarments,
                    firedRules: newFiredRules,
                    explanation: null // Always rule tags after swap, even on Pro
                  });
                }}
              />
            ))}
          </div>

          {/* Why this works */}
          {pendingResult.explanation ? (
            <p className="text-sm text-[var(--muted)]">{pendingResult.explanation}</p>
          ) : pendingResult.firedRules.length > 0 ? (
            <div className="bg-[var(--surface)] rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] mb-2">Why this works</p>
              <div className="flex flex-wrap gap-1.5">
                {pendingResult.firedRules.map((rule, i) => (
                  <span key={i} className="text-[10px] bg-white border border-[var(--line)] rounded px-2 py-1 text-[var(--muted)]">
                    {rule.description}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---- Swap chip sub-component ----

interface SwapChipProps {
  garment: OutfitGarmentPreview;
  onSwap: (newGarment: OutfitGarmentPreview) => void;
}

function SwapChip({ garment, onSwap }: SwapChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [candidates, setCandidates] = useState<GarmentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function openDropdown() {
    setIsOpen(true);
    if (candidates.length === 0) {
      setIsLoading(true);
      const results = await getSwapCandidatesAction(garment.role, garment.id);
      setCandidates(results);
      setIsLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-0 border border-[var(--line)] rounded-xl bg-white overflow-hidden">
        <div className="w-11 h-11 bg-[var(--surface)] flex-shrink-0">
          {garment.preview_url && (
            <img src={garment.preview_url} alt={garment.title ?? garment.category} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="px-2.5">
          <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted)]">{garment.role}</p>
          <p className="text-xs font-medium text-[var(--foreground)]">{garment.title ?? garment.category}</p>
        </div>
        <button
          onClick={openDropdown}
          className="px-2 text-[var(--muted)] hover:text-[var(--foreground)] text-base"
          title="Swap garment"
        >
          ⇄
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 w-56 bg-white border border-[var(--line)] rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {isLoading && <p className="text-xs text-[var(--muted)] px-3 py-2">Loading…</p>}
            {!isLoading && candidates.length === 0 && (
              <p className="text-xs text-[var(--muted)] px-3 py-2">No other options in this role.</p>
            )}
            {candidates.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  onSwap({ id: c.id as string, title: c.title ?? null, category: c.category, role: garment.role, preview_url: c.preview_url ?? null });
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--surface)]"
              >
                <div className="w-8 h-8 rounded bg-[var(--surface)] flex-shrink-0 overflow-hidden">
                  {c.preview_url && (
                    <img
                      src={c.preview_url}
                      alt={c.title ?? c.category}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">{c.title ?? c.category}</p>
                  <p className="text-[10px] text-[var(--muted)] truncate">{c.category}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
