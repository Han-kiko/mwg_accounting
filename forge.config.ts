import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Windows 下 electron-packager 会自动使用 images/icon.ico；icon.png 留给以后 Mac 打包
    icon: './images/icon',
    // vite 插件默认只打包 .vite 构建产物、其余一律忽略，但原生模块 better-sqlite3
    // 的实体文件（.node 二进制）无法被 vite 打进包里，必须额外保留，否则打包出的
    // 应用启动即崩溃（2026-09-14 打包时发现）。其余纯 JS 依赖已被 vite 打进 bundle，
    // 无需保留实体文件；开发依赖由打包器在模块根目录层面自动剔除。
    ignore: (file: string) => {
      if (!file) return false;
      const f = file.startsWith('/') ? file : '/' + file;
      return !(
        f.startsWith('/.vite') ||
        f === '/node_modules' ||
        f.startsWith('/node_modules/better-sqlite3')
      );
    },
  },
  // better-sqlite3 v13 自带通用预编译二进制（Node-API），无需针对 Electron 重新编译
  rebuildConfig: {
    onlyModules: [],
  },
  makers: [
    new MakerSquirrel({
      // Windows 安装包（Setup.exe）的图标
      setupIcon: './images/icon.ico',
    }),
    // 绿色免安装版：Windows 上打 ZIP（原配置只给 darwin）
    new MakerZIP({}, ['win32']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
