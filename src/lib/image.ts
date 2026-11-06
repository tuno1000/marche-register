/**
 * 商品画像の縮小（04-技術設計 7.1、要件定義 6.6）
 * 長辺 400px の JPEG にする。60KB を超えたら画質を下げてやり直す。
 */

export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

export const MAX_EDGE = 400;
export const MAX_BYTES = 60 * 1024;
export const QUALITIES = [0.8, 0.7, 0.6] as const;

/** 長辺が max に収まる大きさ。小さい画像は大きくしない */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** 画質を順に下げて、maxBytes 以下になったものを返す。最後まで超えたら、いちばん低い画質のもの */
export async function encodeWithinLimit(
  encode: (quality: number) => Promise<Blob>,
  qualities: readonly number[] = QUALITIES,
  maxBytes: number = MAX_BYTES,
): Promise<Blob> {
  let blob: Blob | undefined;
  for (const quality of qualities) {
    blob = await encode(quality);
    if (blob.size <= maxBytes) return blob;
  }
  if (!blob) throw new Error('画質の指定がありません');
  return blob;
}

/** 選んだ写真を縮小する。読み込めない形式なら例外 */
export async function resizeImage(file: Blob): Promise<ResizedImage> {
  const source = await decode(file);
  try {
    const { width, height } = fitWithin(source.width, source.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('画像を描けません');
    // 透明な部分は白にする（JPEG は透明にできないため）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source.image, 0, 0, width, height);
    const blob = await encodeWithinLimit((quality) => toJpeg(canvas, quality));
    return { blob, width, height };
  } finally {
    source.release();
  }
}

interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: Blob): Promise<Decoded> {
  // createImageBitmap は写真の向きの情報も反映する
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // 読めない形式のときは <img> でも試す
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      image: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('画像を保存できません'))),
      'image/jpeg',
      quality,
    );
  });
}
