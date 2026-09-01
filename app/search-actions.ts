"use server";

import { globalSearch, type SearchResult } from "@/lib/domain/search/service";

export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  try {
    return await globalSearch(query);
  } catch {
    return [];
  }
}
