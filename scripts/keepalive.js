// 保活疫苗：本机存在文件流间歇性停滞的问题，
// 停滞期间若事件循环无其他挂起任务，Node 会以 0 状态码静默退出（任务丢失）。
// 原理：挂一个空定时器，让事件循环永不空转，流停滞时就地等待，I/O 恢复后继续执行。
//
// 但盲目的 setInterval 有两个致命副作用（2026-09-14 打包时踩过）：
// 1. 一次性进程（node -p 探测、npm 启动脚本内的探测）永不退出，
//    会让父进程的 $(...) 命令替换永远等待，npm 直接无法启动；
// 2. @electron/fuses 打包时会以 ELECTRON_RUN_AS_NODE=1 启动一次性辅助进程
//    翻转保险丝，若它不退出，打包会卡死在 Finalizing package。
// 因此：一次性进程直接跳过；长驻进程用「事件循环只剩自己时才解除」的方式，
// 既能扛过流停滞（停滞期间有挂起的写句柄），又不会阻止正常收尾退出。
const isOneShot =
  process.env.ELECTRON_RUN_AS_NODE === '1' || // Electron 冒充 Node 的一次性辅助进程
  // node -p / -e 一次性模式：argv 里不含脚本名，只有 node 自身路径
  (process.argv.length === 1 && process.argv[0] === process.execPath) ||
  process.argv.includes('-p') ||
  process.argv.includes('--print');

if (!isOneShot) {
  // 标记写到 stderr：stdout 可能被父进程的命令替换 $(...) 捕获，污染输出
  console.error('[keepalive] 注入成功 pid=' + process.pid);
  const stdioHandles = [
    process.stdin && process.stdin._handle,
    process.stdout && process.stdout._handle,
    process.stderr && process.stderr._handle,
  ];
  const intervalMs = Number(process.env.KEEPALIVE_MS) || 60000;
  const timer = setInterval(() => {
    // 除本定时器和标准输入输出（fd 0/1/2）外，事件循环里还有其他挂起的句柄
    // → 还有活干，继续保活
    const isStdio = (h) =>
      stdioHandles.includes(h) ||
      (typeof h.fd === 'number' && h.fd >= 0 && h.fd <= 2);
    const busy = process._getActiveHandles().some((h) => h !== timer && !isStdio(h));
    if (process.env.KEEPALIVE_DEBUG) {
      console.error(
        '[keepalive-debug] busy=' +
          busy +
          ' handles=' +
          process
            ._getActiveHandles()
            .map(
              (h) =>
                ((h.constructor && h.constructor.name) || typeof h) +
                '(fd=' +
                h.fd +
                ',stdout=' +
                (h === stdioHandles[1]) +
                ')'
            )
            .join(',')
      );
    }
    // 只剩自己（和标准输入输出）→ 工作已全部完成，解除保活，让进程正常退出
    if (!busy) clearInterval(timer);
  }, intervalMs);
}
