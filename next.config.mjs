/** @type {import('next').NextConfig} */
const nextConfig = {
  // Evita que Turbopack/Webpack empaqueten libs nativas/pesadas (Baileys + WAProto
  // son la principal causa de picos de RAM y caché .next de +1GB en este proyecto).
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'pino',
    'pino-pretty',
    'qrcode',
    'jimp',
    'sharp',
    'libsignal',
    'protobufjs',
    'ws',
  ],

  // En dev no mantenga demasiadas páginas compiladas en memoria.
  onDemandEntries: {
    maxInactiveAge: 20 * 1000,
    pagesBufferLength: 2,
  },

  experimental: {
    // Reduce uso de RAM del compilador webpack en desarrollo.
    webpackMemoryOptimizations: true,
  },

  // Agregamos configuración vacía de turbopack para solucionar error en despliegue
  turbopack: {},


  webpack: (config, { dev }) => {
    if (dev) {
      // Menos presión de watchers/filesystem en Windows.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/docs/**',
          '**/scratch/**',
        ],
        aggregateTimeout: 400,
      };
    }
    return config;
  },
};

export default nextConfig;
