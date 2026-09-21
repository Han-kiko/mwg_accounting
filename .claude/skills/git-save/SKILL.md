---
name: git-save
description: "Save the mwg-accounting (mwg记账) project to GitHub — stage the changes, write a commit, and push to the user's repository （「存档」「保存到 GitHub」「上传代码」「推送到云端」). Use when the user asks to save or back up the project, or types /git-save."
---

# Save the project to GitHub

Back up the project by committing the current changes and pushing them to
GitHub. The user does not use git — report in plain Chinese and never make
them run commands.

## Repository facts

- Remote: `https://github.com/Han-kiko/mwg_accounting` (public)
- GitHub is unreachable directly from this machine. A proxy is required, set
  per-repo as `http.https://github.com.proxy = http://127.0.0.1:7897`.
- Commit messages are English and end with the Co-Authored-By trailer.

## Steps

1. **Check the proxy first.** Confirm the proxy software is running before
   touching git:

   `curl -s -o /dev/null -w '%{http_code}' --max-time 8 -x http://127.0.0.1:7897 https://github.com`

   Anything other than a connection failure means the proxy is up. If it
   fails, stop and tell the user in Chinese to start their proxy software,
   then try again. Do not push without it.

2. **Look at what would be saved.** Run `git status --short` and
   `git diff --stat`, and read them.

3. **Refuse to commit anything that looks like personal data.** The
   accounting database and its side files (`*.db`, `*.db-wal`, `*.db-shm`)
   must never be committed; `.gitignore` covers them, but verify anyway. If
   `git status` lists one, stop and report it instead of committing. Also
   stop and ask if any file looks like a secret — a password, a token, an
   API key.

4. **Note the branch.** `git branch --show-current`. Push that branch.
   Never force-push, never rewrite history, never delete a remote branch.

5. **Satisfy the pre-commit quality gate.**

   This repo installs a `pre-commit` hook (`.githooks/pre-commit`) that
   **aborts the commit** unless both marker files exist, both say `exit=0`,
   and both carry a `tree=` fingerprint equal to the current staged tree:

   - `.git/quality-gate.test.marker` (unit tests, written by `tester`)
   - `.git/quality-gate.lint.marker` (code style, written by `quality-engineer`)

   Check before committing:

   ```sh
   git add -A
   git write-tree                                  # the current fingerprint
   grep -h '^tree=' .git/quality-gate.*.marker     # must both match it
   ```

   - **Markers valid** → commit straight away. Do not re-run the checks; that
     is wasted work and the hook does not need it.
   - **Missing or stale** → run the gate first: follow the freeze protocol in
     `.claude/agents/gitcommit-agent.md`. In practice that means spawning the
     `tester` and `quality-engineer` agents in parallel, letting them write
     the markers, then committing.

   If a check genuinely fails, stop and report it in Chinese — never commit a
   broken state. (The hook would refuse it anyway.)

   **Never pass `--no-verify` to `git commit`, and never set the
   `SKIP_QUALITY_GATE` variable.** Both bypasses belong to the human, not to
   you. When the gate blocks you, the correct move is to report it in Chinese —
   not to route around it.

6. **Commit.** Stage the changes and write an English commit message that
   summarises what actually changed, ending with:

   `Co-Authored-By: Claude Code <noreply@anthropic.com>`

   If there is nothing to commit, say so and skip to step 8.

7. **Push.** `git push` the current branch. If the branch has no upstream
   yet, use `git push -u origin <branch>`.

8. **Report in Chinese** using the format below.

## Report format

- which branch was pushed
- the commit message, explained in plain Chinese
- how many files changed, grouped with a one-line description each
- the test and lint results
- the repository link: https://github.com/Han-kiko/mwg_accounting
- if anything was skipped or failed, say exactly what and why

## Edge cases

- **Push fails with a network error.** Almost always the proxy. Say so in
  Chinese, tell the user to start the proxy software and try again.
- **Push is rejected as non-fast-forward.** Do not force. Report it and ask
  the user how to proceed — it means the cloud copy has changes the local
  copy does not.
- **Nothing to save.** Say 「没有需要存档的改动」 and stop. Never create an
  empty commit.
- **The user seems to mean a different folder.** This skill only saves the
  project it runs in. Ask which folder they mean before doing anything.
