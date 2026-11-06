import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const green = '#1f6f43';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // 端まで緑で塗る（白い余白が出ないように）
    apple: { sizes: [180], padding: 0.1, resizeOptions: { background: green } },
    maskable: { sizes: [512], padding: 0.2, resizeOptions: { background: green } },
  },
  images: ['public/icon.svg'],
});
