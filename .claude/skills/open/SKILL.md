---
name: open
description: Launch the mwg-accounting (mwg记账) desktop app so the user can see and use it. Use when the user asks to open / start / launch the app (例如「打开 app」「启动应用」), or types /open.
---

# Open the app

Launch the desktop app so the user can see it running.

## Steps

1. From the project root, run:

   env -u ELECTRON_RUN_AS_NODE npm start

   IMPORTANT: Keep the `env -u ELECTRON_RUN_AS_NODE` prefix. The VSCode
   terminal injects ELECTRON_RUN_AS_NODE=1, which makes Electron run as a
   plain Node program and fail to open. Stripping that variable fixes it.

2. Wait a few seconds for the app window to appear, then confirm to the
   user in Chinese that the app has started.

3. If startup fails, show the error output and explain in plain Chinese
   what went wrong.
