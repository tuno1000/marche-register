import ui from '../../components/ui.module.css';

/**
 * ［印刷］：ブラウザの印刷を開く。印刷されるのはレシートだけ（global.css の @media print）。
 * iPhone では印刷の画面から、AirPrint のプリンターで印刷するか、PDF にして共有できる
 */
export function PrintButton() {
  // 印刷に対応していない環境では出さない
  if (typeof window.print !== 'function') return null;
  return (
    <button type="button" className={`${ui.button} ${ui.large}`} onClick={() => window.print()}>
      印刷
    </button>
  );
}
