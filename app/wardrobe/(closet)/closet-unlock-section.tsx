import { listLookbookEntries } from "@/lib/domain/lookbook/service";
import {
  lookbookUnlockCandidates,
  trendUnlockCandidates
} from "@/lib/domain/outfits/appeal";
import { listUserTrendMatchesWithSignals } from "@/lib/domain/outfits/service";
import { scoreUnlockCandidates } from "@/lib/domain/outfits/unlock";
import { listStyleRules } from "@/lib/domain/style-rules/service";
import { listWardrobeGarments } from "@/lib/domain/wardrobe/service";
import { UnlockCard } from "@/components/unlock-card";

export async function ClosetUnlockSection() {
  const [garments, styleRules, trendMatches, lookbookEntries] = await Promise.all([
    listWardrobeGarments(),
    listStyleRules(),
    listUserTrendMatchesWithSignals(),
    listLookbookEntries()
  ]);
  const topUnlock = scoreUnlockCandidates(garments, styleRules, [
    ...trendUnlockCandidates(trendMatches),
    ...lookbookUnlockCandidates(lookbookEntries)
  ])[0];
  if (!topUnlock || topUnlock.unlock_count < 3) return null;
  return <UnlockCard score={topUnlock} />;
}
