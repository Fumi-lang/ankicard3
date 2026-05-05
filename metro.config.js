// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * Zustand v5 の ESM ファイル（esm/*.mjs）には `import.meta.env.MODE` が含まれており、
 * Metro（Expo Web）は非モジュールスクリプトとして出力するためブラウザが
 * SyntaxError で拒否する。
 *
 * CJS 版（middleware.js）には `import.meta` が一切ないため、
 * `zustand/middleware` だけを CJS ファイルへ強制解決することで回避する。
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'zustand/middleware') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/zustand/middleware.js'),
      type: 'sourceFile',
    };
  }
  // 他のモジュールはデフォルトの解決ロジックに委譲する
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
