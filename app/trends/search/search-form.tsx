"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchTrendsForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        router.push(`/trends/search?q=${encodeURIComponent(value)}`);
      }}
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="search trends"
        className="w-full rounded-[100px] border border-[rgba(30,26,23,.22)] bg-transparent px-4 py-2 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--stone)]"
      />
    </form>
  );
}
