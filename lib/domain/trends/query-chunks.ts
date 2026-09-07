/** PostgREST `.in()` filters go on the query string. Too many UUIDs → HTTP 400 "Bad Request". */
export const POSTGREST_IN_CHUNK = 80;

export function chunkIds(ids: string[], size = POSTGREST_IN_CHUNK): string[][] {
  if (ids.length === 0) {
    return [];
  }

  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}
