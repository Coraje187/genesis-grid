export type Tier = "starter" | "balanced" | "performance" | "workstation";

export interface SystemProfile {
  total_ram_gb: number;
  cpu_cores: number;
  cpu_brand: string;
  gpu_name: string | null;
  gpu_vram_gb: number | null;
  tier: Tier;
  tier_label: string;
}

export interface CatalogEntry {
  id: string;
  display_name: string;
  tier: Tier;
  approx_gb: number;
  role: string;
}

const TIER_ORDER: Tier[] = ["starter", "balanced", "performance", "workstation"];

export function tierIndex(t: Tier): number {
  return TIER_ORDER.indexOf(t);
}

/** A model "fits comfortably" if its minimum tier is at or below the
 * machine's tier — this is the only thing the main UI shows; no GB/param
 * counts unless the user opens Advanced. */
export function fitsComfortably(profile: SystemProfile, entry: CatalogEntry): boolean {
  return tierIndex(entry.tier) <= tierIndex(profile.tier);
}

export const TIER_COPY: Record<Tier, { headline: string; body: string }> = {
  starter: {
    headline: "Your PC is set up for our Light models.",
    body: "These run smoothly without slowing anything else down. You can still try bigger models — they'll just be slower.",
  },
  balanced: {
    headline: "Your PC can comfortably run our Balanced models.",
    body: "A good mix of speed and capability. Want to try something Faster or heavier? You can, it just depends on your patience.",
  },
  performance: {
    headline: "Your PC can handle our Fast models with room to spare.",
    body: "You've got the RAM and GPU for it — most models on the list will feel snappy.",
  },
  workstation: {
    headline: "Your PC is a powerhouse — anything on the list will run well.",
    body: "You could even look at running two models side by side for comparison.",
  },
};
