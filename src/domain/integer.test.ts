import { describe, expect, it } from 'vitest';
import { allocate, ceilDiv, floorDiv } from './integer';

describe('整数の割り算', () => {
  it('切り捨てと切り上げ', () => {
    expect(floorDiv(5550, 100)).toBe(55);
    expect(ceilDiv(5550, 100)).toBe(56);
    expect(floorDiv(5500, 100)).toBe(55);
    expect(ceilDiv(5500, 100)).toBe(55);
  });
});

describe('按分', () => {
  it('03 の 4.3 の例：100 円を 540 と 450 で分けると 55 と 45', () => {
    expect(allocate(100, [540, 450])).toEqual([55, 45]);
  });

  it('比率が同じときは、優先度の小さいほうに余りを足す', () => {
    expect(allocate(1, [100, 100], [0, 1])).toEqual([1, 0]);
    expect(allocate(1, [100, 100], [1, 0])).toEqual([0, 1]);
  });

  it('余りは比率の大きい順に 1 円ずつ', () => {
    // 5 を 3:3:1 で分ける → 2.14.., 2.14.., 0.71.. → 2, 2, 0 と余り 1 → 比率の大きい先頭へ
    expect(allocate(5, [3, 3, 1])).toEqual([3, 2, 0]);
  });

  it('比率が 0 の項目には配らない', () => {
    expect(allocate(5, [0, 3, 0, 7])).toEqual([0, 1, 0, 4]); // 1.5, 3.5 → 1, 3 と余り 1 → 7 へ
  });

  it('分ける額が比率の合計を超えたらエラー', () => {
    expect(() => allocate(11, [5, 5])).toThrow(RangeError);
  });
});
