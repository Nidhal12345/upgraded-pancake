/**
 * Overlap layout for a single day column. Events that overlap in time are
 * grouped into clusters; each event gets a lane within its cluster. Width is
 * shared across the cluster's lanes, and an event expands right into free lanes.
 */
export interface LayoutInput {
  id: string;
  start: number;
  end: number;
}
export interface LayoutResult {
  lane: number;
  lanes: number;
  span: number;
}

export function layoutDay<T extends LayoutInput>(items: T[]): Map<string, LayoutResult> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = new Map<string, LayoutResult>();
  let cluster: { item: T; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const lanes = laneEnds.length;
    for (const c of cluster) {
      // expand right while the next lanes are free for this item's time range
      let span = 1;
      for (let l = c.lane + 1; l < lanes; l++) {
        const blocked = cluster.some((o) => o.lane === l && o.item.start < c.item.end && o.item.end > c.item.start);
        if (blocked) break;
        span++;
      }
      out.set(c.item.id, { lane: c.lane, lanes, span });
    }
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else laneEnds[lane] = item.end;
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length) flush();
  return out;
}

export const SNAP = 15;
export const snap = (m: number, step = SNAP) => Math.round(m / step) * step;
