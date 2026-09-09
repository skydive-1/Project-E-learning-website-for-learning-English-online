import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import viteImagemin from 'vite-plugin-imagemin';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src')
    }
  },
  plugins: [
    react(),
    viteImagemin({
      gifsicle: {
        optimizationLevel: 3,
        interlaced: true
      },
      optipng: {
        optimizationLevel: 3
      },
      mozjpeg: {
        quality: 80
      },
      pngquant: {
        quality: [0.7, 0.8],
        speed: 4
      },
      svgo: {
        plugins: [
          { name: 'removeViewBox', active: false },
          { name: 'removeDimensions', active: true },
          { name: 'removeXMLNS', active: true }
        ]
      }
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.ico', 'logo192.png', 'logo512.png', 'robots.txt'],
      manifest: {
        name: 'E-Learn Academy',
        short_name: 'E-Learn',
        description: 'Nền tảng học tiếng Anh trực tuyến hiện đại với lộ trình cá nhân hóa, bài tập tương tác và trợ lý AI thông minh.',
        theme_color: '#0F172A',
        background_color: '#0F172A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon'
          },
          {
            src: '/logo192.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any'
          },
          {
            src: '/logo192.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'maskable'
          },
          {
            src: '/logo512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any'
          },
          {
            src: '/logo512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Precache build artifacts (HTML, CSS, JS, Fonts, Icons)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2,ttf}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        navigateFallback: '/index.html',
        // Deny fallback for API routes and dynamic uploaded content
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // 1. Google Fonts stylesheets (stale while revalidate)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          // 2. Google Fonts webfont files (cache first)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // 3. Static Images (Cache First, only for static non-api assets)
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    host: '127.0.0.1',
    port: 3001,
    open: true,
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      }
    },
    watch: {
      usePolling: true
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        // Tách các thư viện nặng, ít khi dùng cùng lúc, ra chunk riêng.
        // Giúp: (1) trình duyệt cache độc lập từng thư viện giữa các lần
        // deploy (chunk chính đổi nhưng shaka/recharts không đổi thì
        // không cần tải lại); (2) tránh cảnh báo "chunk vượt 500kB" dồn
        // hết vào 1 file; (3) các trang không dùng video/chart (vd trang
        // login) tải nhanh hơn vì trình duyệt có thể ưu tiên fetch song
        // song thay vì 1 file JS khổng lồ.
        manualChunks: {
          'vendor-shaka': ['shaka-player'],
          'vendor-charts': ['recharts'],
          'vendor-pdf': ['react-pdf']
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
  }
});
