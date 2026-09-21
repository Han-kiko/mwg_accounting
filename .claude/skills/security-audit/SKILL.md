---
name: security-audit
description: "Audit the mwg-accounting (mwg记账) project for security problems and report them in Chinese with severity levels — leaked secrets and passwords, SQL or code injection risks, plaintext leaks in config files, and other unsafe code （「安全检查」「安全审计」「有没有漏洞」「代码安全吗」). Report first and only change code after the user approves, or when the user types /security-audit."
---

# Security audit

Audit the project for security problems, report them in Chinese, then wait for
the user's approval before changing anything.

The user is not a programmer. Every finding must explain the risk in plain
Chinese — what could actually go wrong, and to whom.

## What to look for

### 1. Leaked secrets

Hardcoded passwords, API keys, tokens, private keys, connection strings, and
personal data baked into source. Check config files too: .npmrc, package.json,
forge.config.ts, vite/\*.config.ts, vitest.config.ts, tsconfig.json,
index.html, .env if present.

Also check that .gitignore actually covers what must never be committed
(.env, *.db, log files, build output).

### 2. Injection

- SQL built by string concatenation or interpolation of user input. Careful:
  a value bound through a `?` placeholder stays safe even when the SQL text is
  assembled with a template literal. Do not report that as injection.
- Shell execution with untrusted input (exec, execSync, spawn with
  `shell: true`).
- Code execution: eval, new Function, require of a computed path.
- Path traversal: path.join with unchecked user input.

### 3. Plaintext leaks in configuration

Secrets written literally into config instead of read from the environment.
Absolute local paths that leak the machine layout or username into shipped
files. Debug flags or verbose logging that would print sensitive values.

### 4. Other risks

- Electron hardening in BrowserWindow `webPreferences`: contextIsolation,
  nodeIntegration, sandbox, webSecurity. Flag anything weakened, and say what
  it exposes.
- IPC handlers in the main process: every handler reachable from the renderer
  must validate its input. An unvalidated one is a hole.
- Rendering untrusted text as HTML (dangerouslySetInnerHTML), or navigating to
  a URL built from data.
- Anything that could destroy the user's data: an unqualified DELETE, or a
  write outside the intended data directory.
- Error messages that leak internals back to the user.

## Scope

Default: every source file under src/, plus project-level config in the repo
root — package.json, forge.config.ts, vite.\*.config.ts, vitest.config.ts,
tsconfig.json, .npmrc, index.html. Skip node_modules, .vite/, out/, and build
output. Never scan the user's real database file.

## Workflow

1. Read the files in scope.
2. Collect findings.
3. Report in Chinese using the format below.
4. **Do not change any file yet.** Ask which findings to fix. Apply only the
   approved ones, then re-report and run `npm test` if anything under src/ was
   touched.

## Report format

Order findings most severe first. For each one give:

- a one-line title
- severity: 🔴 高 / 🟡 中 / 🟢 低
- the file and line number
- what the code does wrong, in plain Chinese, with the risky snippet quoted
- **what could actually happen** — the concrete bad outcome, not a theory
- how to fix it, in plain Chinese

Then a short summary table of counts by severity, and a one-line verdict: is
the project basically safe, or does something need attention now?

If nothing is wrong, say so plainly. **Do not invent findings to look
thorough.** A clean config file is a clean config file.

## Severity guide

- 🔴 高 — a real secret is exposed, or user input can reach SQL / shell / eval
  unchecked, or the user's data can be destroyed.
- 🟡 中 — a weakness that needs another condition to be exploited, or an
  Electron setting that weakens the app's isolation.
- 🟢 低 — hardening advice and hygiene, no immediate risk.

## Explaining to a non-programmer

Use everyday comparisons and name the real-world consequence. For example:

"这一段把用户填的备注直接拼进了数据库命令，就像把别人递来的纸条直接念给
银行柜员听——纸条上如果写的是『顺便把我账户清空』，柜员也会照做。"

Avoid unexplained jargon: CVE numbers, "attack surface", "threat model",
"sanitization".

## Edge cases

- **The user disagrees with a finding.** Explain the concrete scenario again,
  or accept it and mark it as accepted risk. Do not argue.
- **A finding turns out to be a false alarm on a second read.** Say so and
  drop it. Accuracy matters more than a long list.
- **The user approves fixes.** Make the smallest change that removes the risk.
  Do not refactor unrelated code, and do not weaken a security fix just to
  keep a feature working — tell the user the trade-off instead.
