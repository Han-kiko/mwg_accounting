---
name: comments-check
description: "Review code comments in the mwg-accounting (mwg记账) project and report problems to the user in Chinese — missing comments, comments that no longer match the code, and comments too hard for a beginner to follow （「检查注释」「注释有没有问题」「补注释」). Report first and only edit code after the user approves, or when the user types /comments-check."
---

# Check code comments

Audit the comments in this project against three rules, report the problems in
Chinese, then wait for the user's approval before editing anything.

## The three rules

1. **Completeness** — every function and every non-obvious block needs a
   comment. A comment must say what the code is for, not restate its syntax.
2. **Accuracy** — the comment must match what the code actually does. Flag
   stale comments left behind by a later change, wrong units, wrong field
   names, and descriptions of behaviour that is no longer there.
3. **Beginner readability** — the reader is someone just starting to learn
   programming. Comments are written in Chinese and explain the approach in
   plain words. Flag comments that are too terse (`init`, `fix`), crowded with
   unexplained jargon, or that assume knowledge of the whole system.

## Scope

Default: every TypeScript source under src/ (*.ts, *.tsx). Include
vitest.config.ts and vite.*.config.ts when the user asks for the whole project.
Skip node_modules, .vite/, and build output.

## Workflow

1. Read the target files.
2. Collect findings per file.
3. Report to the user in Chinese, using the format below.
4. **Do not edit any file yet.** Ask whether to fix the findings. Apply fixes
   only after the user approves, then re-report what changed.

## Report format

Group findings by file. For each finding give:

- the file and line number
- which of the three rules it breaks
- the current comment, quoted (or 「（无注释）」)
- what is wrong, in plain Chinese
- a suggested replacement comment, written in Chinese

Close with a short summary: how many files were checked, how many findings,
broken down into missing comments / mismatches / readability.

If a file is clean, say so in one line. Do not invent problems to look
thorough.

## Style for suggested comments

- Chinese, one to three lines.
- Lead with what the code does or why it exists. Add an implementation detail
  only when it genuinely helps, e.g. why money is stored as an integer, or why
  the test database lives in a temp directory.
- Never restate obvious syntax (`// 循环遍历数组`).
- Leave good existing comments alone.
- Comments are Chinese; function and variable names stay English.

## Edge cases

- **A comment contradicts the code.** Report it as a mismatch and ask which one
  is correct. Do not assume the code is right.
- **The user wants every single line commented.** Push back gently. Name the
  lines that are obvious and would only add noise.
- **The user has approved fixes.** Apply them, then run `npm test` if the
  touched files are covered by tests, and report the result.
