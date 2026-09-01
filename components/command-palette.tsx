"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { globalSearchAction } from "@/app/search-actions";
import type { SearchResult } from "@/lib/domain/search/service";

const KIND_LABEL: Record<SearchResult["kind"], string> = {
  piece: "piece",
  look: "look",
  trend: "trend",
  listing: "nearby"
};

/** w3c — ⌘K search across pieces, looks, trends and nearby. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      const found = await globalSearchAction(query);
      setResults(found);
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh]">
      <button
        type="button"
        aria-label="dismiss"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-[rgba(12,10,9,.55)]"
      />
      <div className="gw-pop relative w-full max-w-[480px] rounded-[14px] border border-[rgba(30,26,23,.11)] bg-[var(--cream,#fff)] p-2 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[rgba(30,26,23,.11)] px-3 py-3">
          <Search size={15} strokeWidth={1.5} className="text-[var(--stone)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="search pieces, looks, trends, nearby"
            className="flex-1 bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto py-1">
          {results.map((result) => (
            <button
              key={`${result.kind}-${result.id}`}
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(result.href as never);
              }}
              className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left hover:bg-[rgba(30,26,23,.05)]"
            >
              <span className="text-[13px] text-[var(--ink)]">{result.title}</span>
              <span className="text-[10px] uppercase tracking-[.12em] text-[var(--stone)]">
                {KIND_LABEL[result.kind]}
              </span>
            </button>
          ))}
          {query.trim().length >= 2 && results.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-[var(--stone)]">no matches</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
