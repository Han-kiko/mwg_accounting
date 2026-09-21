---
name: test
description: Write and run unit tests for the mwg-accounting (mwg记账) project code, then summarize the results for the user in Chinese. Use when the user asks to test code, write unit tests, run tests (「帮我测试」「写单元测试」「跑一下测试」), or types /test.
---

# Test the code

Create unit tests for the project's code, run them, and give the user a test report.

## Steps

1. Identify what to test:
   - Default scope: core data logic in src/db.ts (add/update/delete expenses,
     monthly stats, category tree, list filtering).
   - If the user names specific code, test that instead.
2. Create or update test files next to the code (src/db.test.ts style).
   - Mock the `electron` module (vi.mock) so the database is created in a
     fresh temporary directory for each test run; never touch the user's
     real accounting data.
3. Run the tests: npm test
4. Report the results to the user in Chinese:
   - total / passed / failed counts
   - for each failure: which test, why it failed (plain Chinese)
   - offer to fix the code or the test and re-run
