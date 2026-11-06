import QRCode from 'qrcode';
import { useMemo } from 'react';

/**
 * QR コード（端末の中で作るので、オフラインでも表示できる。要件定義 F-06）
 */
export function QrCode({
  text,
  size = 112,
  label,
}: {
  text: string;
  size?: number;
  label: string;
}) {
  const path = useMemo(() => {
    try {
      const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
      const n = modules.size;
      let d = '';
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
        }
      }
      return { d, n };
    } catch {
      return null;
    }
  }, [text]);

  if (!path) return null;
  const margin = 2;
  const total = path.n + margin * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`${-margin} ${-margin} ${total} ${total}`}
      shapeRendering="crispEdges"
      style={{ background: '#ffffff' }}
    >
      <path d={path.d} fill="#000000" />
    </svg>
  );
}
