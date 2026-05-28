/* global __MPHELPER_VERSION__ */

// Replaced at build time via esbuild `define`. Falls back to 'dev' when the
// source is loaded outside the bundler (e.g. while editing).
export const VERSION = typeof __MPHELPER_VERSION__ === 'string'
    ? __MPHELPER_VERSION__
    : 'dev';
