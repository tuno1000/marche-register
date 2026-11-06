import { describe, expect, it } from 'vitest';
import { encodeWithinLimit, fitWithin, MAX_BYTES } from './image';

describe('画像の縮小', () => {
  it('長辺を 400px にそろえ、縦横の比は保つ', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 400, height: 300 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 300, height: 400 });
    expect(fitWithin(1000, 1000)).toEqual({ width: 400, height: 400 });
  });

  it('小さい画像は大きくしない', () => {
    expect(fitWithin(200, 100)).toEqual({ width: 200, height: 100 });
  });

  it('とても細長い画像でも 1px 以上', () => {
    expect(fitWithin(10000, 1)).toEqual({ width: 400, height: 1 });
  });

  it('60KB 以下になるまで画質を 0.8 → 0.7 → 0.6 と下げる', async () => {
    const tried: number[] = [];
    const sizes: Record<number, number> = { 0.8: 90_000, 0.7: 70_000, 0.6: 50_000 };
    const blob = await encodeWithinLimit(async (q) => {
      tried.push(q);
      return new Blob([new Uint8Array(sizes[q]!)]);
    });
    expect(tried).toEqual([0.8, 0.7, 0.6]);
    expect(blob.size).toBe(50_000);
  });

  it('最初の画質で収まれば、それで終わる', async () => {
    const tried: number[] = [];
    await encodeWithinLimit(async (q) => {
      tried.push(q);
      return new Blob([new Uint8Array(MAX_BYTES)]);
    });
    expect(tried).toEqual([0.8]);
  });

  it('いちばん低い画質でも超えたら、そのまま使う', async () => {
    const blob = await encodeWithinLimit(async () => new Blob([new Uint8Array(MAX_BYTES + 1)]));
    expect(blob.size).toBe(MAX_BYTES + 1);
  });
});
