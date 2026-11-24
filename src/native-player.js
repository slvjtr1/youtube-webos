import { createCore } from './core-runtime';
export function createTimeline(segments, categories) {
  const index = createCore();
  segments.forEach((item, i) => {
    if (
      categories.includes(item.category) &&
      index.add_segment(item.segment[0], item.segment[1], i) < 0
    )
      throw new Error('Insufficient memory for SponsorBlock timeline');
  });
  index.finish_index();
  return (now) => segments[index.next_segment(now)];
}
