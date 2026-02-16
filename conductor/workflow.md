# Project Workflow

## Guiding Principles

1. **The Plan is the Source of Truth:** All work must be tracked in `plan.md`
2. **The Tech Stack is Deliberate:** Changes to the tech stack must be documented in `tech-stack.md` *before* implementation
3. **Test-Driven Development:** Write unit tests before implementing functionality
4. **High Code Coverage:** Aim for >80% code coverage for all modules
5. **User Experience First:** Every decision should prioritize user experience
6. **Non-Interactive & CI-Aware:** Prefer non-interactive commands. Use `CI=true` for watch-mode tools (tests, linters) to ensure single execution.

## Plan Generation Guidelines

When creating a new track, the **first step** — before writing any track files (spec, plan, decisions, index) — is to create a worktree for the track's branch. All track files must be created and committed inside the worktree, never in the main worktree. See the "Worktree Isolation" section below for the exact procedure.

The track's `index.md` **must** specify its branch name. Plans should not include worktree setup as a task — it is a prerequisite that happens before any track work begins.

Follow these rules for manual verification tasks:

1. **Only include a `Conductor - User Manual Verification` task for phases that produce user-facing changes** — changes the user can observe and interact with in a browser or via a simple command.
2. **Do NOT include verification tasks for phases** that only touch data models, types, indexes, internal utilities, API routes without a visible frontend, or isolated components not yet integrated into the UI.
3. **For borderline cases** (e.g., a backend change that alters existing visible behavior, or a refactor that could subtly affect UX), describe what the manual validation would look like and ask the user during plan preparation whether they want to include a manual verification step.
4. **Phase completion and checkpointing always runs.** The absence of a manual verification task does NOT mean the phase skips the Phase Completion Verification and Checkpointing Protocol. That protocol (test coverage, validation suite, checkpoint commit, SHA recording) executes for every phase. The manual verification task in the plan only controls whether steps 4–5 of the protocol (user walkthrough and feedback) are performed.

## Worktree Isolation (Required for All Tracks)

Every track **must** live entirely in its own git worktree — **both planning and implementation**. The main worktree (`/home/zwrose/weekly-eats`) must never be used for track work of any kind (no spec files, no plan files, no code changes, no commits).

### Before Any Track Work (Planning or Implementation)

The worktree must be created **before writing any track files** (spec.md, plan.md, decisions.md, index.md, metadata.json). This means:

1. **Create the worktree** for the track's branch (run from the main worktree):
   ```bash
   ./scripts/worktree-create.sh <branch-name>
   ```
   This auto-assigns a unique port (3001+), clones the database with sample data, generates `.env.local`, and runs `npm install`.

2. **Navigate to the worktree**:
   ```bash
   cd /home/zwrose/weekly-eats-worktrees/<sanitized-branch-name>
   ```

3. **Now begin track work** — create the track directory under `conductor/tracks/`, write spec/plan/decisions files, and commit them. All of this happens inside the worktree.

4. **All subsequent work** (implementation, tests, `npm run check`, `npm run dev`, git commits) also happens inside this worktree.

### After Completing a Track

Clean up the worktree to free disk space:
```bash
./scripts/worktree-remove.sh <branch-name>
```

### Rules

- **One agent per worktree** — never run two agents on the same worktree/branch
- **One worktree per track** — each track gets its own isolated environment
- **Dev server ports are unique** — the script assigns 3001, 3002, etc. automatically
- **Databases are isolated** — each worktree has its own MongoDB database (`weekly-eats-<branch>`)
- **`npm test` and `npm run check` are always safe** — they use fake DB URIs regardless of worktree

### Management Commands

```bash
./scripts/worktree-list.sh              # Show all worktrees with port/database info
./scripts/worktree-create.sh <branch>   # Create worktree (clones DB, installs deps)
./scripts/worktree-remove.sh [branch]   # Remove worktree (interactive menu if no branch given)
```

## Task Workflow

All tasks follow a strict lifecycle:

### Standard Task Workflow

1. **Select Task:** Choose the next available task from `plan.md` in sequential order

2. **Mark In Progress:** Before beginning work, edit `plan.md` and change the task from `[ ]` to `[~]`

3. **Write Failing Tests (Red Phase):**
   - Create a new test file for the feature or bug fix.
   - Write one or more unit tests that clearly define the expected behavior and acceptance criteria for the task.
   - **CRITICAL:** Run the tests and confirm that they fail as expected. This is the "Red" phase of TDD. Do not proceed until you have failing tests.

4. **Implement to Pass Tests (Green Phase):**
   - Write the minimum amount of application code necessary to make the failing tests pass.
   - Run the test suite again and confirm that all tests now pass. This is the "Green" phase.

5. **Refactor (Optional but Recommended):**
   - With the safety of passing tests, refactor the implementation code and the test code to improve clarity, remove duplication, and enhance performance without changing the external behavior.
   - Rerun tests to ensure they still pass after refactoring.

6. **Verify Coverage:** Run `npm test` and review the coverage text summary in the output.
   Target: >80% coverage for new code. Detailed reports are available in `./coverage/` (html, lcov).

7. **Document Deviations:** If implementation differs from tech stack:
   - **STOP** implementation
   - Update `tech-stack.md` with new design
   - Add dated note explaining the change
   - Resume implementation

8. **Commit Code Changes:**
   - Stage all code changes related to the task.
   - Propose a clear, concise commit message e.g, `feat(ui): Create basic HTML structure for calculator`.
   - Perform the commit.

9. **Attach Task Summary with Git Notes (Optional):**
   - **Step 9.1: Get Commit Hash:** Obtain the hash of the *just-completed commit* (`git log -1 --format="%H"`).
   - **Step 9.2: Draft Note Content:** Create a detailed summary using the enhanced format below.
   - **Step 9.3: Attach Note:** Use the `git notes` command to attach the summary to the commit.
     ```bash
     git notes add -m "<note content>" <commit_hash>
     ```

   **Enhanced Git Note Format:**
   ```markdown
   ## Task: [Task Name]

   ### Summary
   [Brief description of what was accomplished]

   ### Why
   [The rationale behind this implementation - why this approach was chosen]

   ### Changes
   - [List of changes made]
   - [Files created/modified]

   ### Decisions Made
   [Reference any ADRs recorded during this task]
   - ADR-001: [Decision title] (see decisions.md)
   - ADR-002: [Decision title] (see decisions.md)

   ### Files Modified
   - path/to/file1.ext
   - path/to/file2.ext
   ```

   **Note:** Git notes are optional. If your team prefers not to use git notes, skip this step. The commit message and plan.md provide core traceability.

10. **Update Plan Status (On Disk Only - Do NOT Commit):**
    - **Step 10.1: Get Commit SHA (if applicable):** If Step 9 was executed, obtain the first 7 characters of the commit hash.
    - **Step 10.2: Update Plan:** Read `plan.md`, find the line for the completed task, update its status from `[~]` to `[x]`, and append the commit SHA (e.g., `- [x] Task: Description [abc1234]`). If no commit was made, use `[uncommitted]`.
    - **Step 10.3: Write Plan:** Write the updated content back to `plan.md`.
    - **IMPORTANT:** Do NOT commit `plan.md` separately. The plan update will be included in the next phase checkpoint commit. This keeps `plan.md` up-to-date on disk for status tracking while reducing commit noise.

### Phase Completion Verification and Checkpointing Protocol

**Trigger:** This protocol is executed immediately after a task is completed that also concludes a phase in `plan.md`.

**CRITICAL:** This protocol **always** runs to completion for every phase — steps 1, 2, 3, 6, 7, 8, and 9 are mandatory. Only steps 4 and 5 (manual verification) are conditional on whether the phase has user-facing changes.

1.  **Announce Protocol Start:** Inform the user that the phase is complete and the verification and checkpointing protocol has begun.

2.  **Ensure Test Coverage for Phase Changes:**
    -   **Step 2.1: Determine Phase Scope:** To identify the files changed in this phase, you must first find the starting point. Read `plan.md` to find the Git commit SHA of the *previous* phase's checkpoint. If no previous checkpoint exists, the scope is all changes since the first commit.
    -   **Step 2.2: List Changed Files:** Execute `git diff --name-only <previous_checkpoint_sha> HEAD` to get a precise list of all files modified during this phase.
    -   **Step 2.3: Verify and Create Tests:** For each file in the list:
        -   **CRITICAL:** First, check its extension. Exclude non-code files (e.g., `.json`, `.md`, `.yaml`).
        -   For each remaining code file, verify a corresponding test file exists.
        -   If a test file is missing, you **must** create one. Before writing the test, **first, analyze other test files in the repository to determine the correct naming convention and testing style.** The new tests **must** validate the functionality described in this phase's tasks (`plan.md`).

3.  **Run Full Validation Suite with Proactive Debugging:**
    -   Before execution, you **must** announce the exact shell command you will use.
    -   **Announcement:** "I will now run the full validation suite to verify the phase. **Command:** `npm run check`"
    -   Execute `npm run check` (lint + test with coverage + build). This catches type errors, lint violations, and test failures.
    -   If any step fails, you **must** inform the user and begin debugging. You may attempt to propose a fix a **maximum of two times**. If the issue persists after your second proposed fix, you **must stop**, report the persistent failure, and ask the user for guidance.
    -   **After `npm run check` passes**, run Quality Intelligence (see Quality Intelligence section below):
        1. **Anti-Pattern Detection**: Review all files modified in this phase for code smells. Present findings to user if any.
        2. **Coverage Intelligence**: Review coverage output, identify under-covered files modified in this phase, suggest tests or create them if below 80%.

4.  **Manual Verification (User-Facing Phases Only):**
    -   **CRITICAL:** Manual verification is only performed for phases that produce user-facing changes — i.e., changes the user can see and interact with in the browser or via a simple command. Phases that only touch data models, internal utilities, backend logic without visible output, or isolated components not yet wired into the UI should **skip steps 4 and 5** and proceed directly to step 6 (checkpoint commit). The remaining steps (6–9) always execute regardless.
    -   To determine if this phase is user-facing, analyze `product.md`, `product-guidelines.md`, and `plan.md` to identify whether the completed phase has observable, user-facing outcomes.
    -   **If the phase IS user-facing**, the agent must **start the dev server, confirm it is running, and then present verification steps to the user.** Follow this procedure:

        **Step 4a — Start the Dev Server:**
        1.  Run `npm run dev` (in the background) inside this worktree.
        2.  Wait for the server to emit the "Ready" message confirming it is accepting connections.
        3.  Determine the correct port from this worktree's `.env.local` (`NEXTAUTH_URL`). **Do not hardcode port 3000** — worktrees use unique ports (3001, 3002, etc.).
        4.  Verify the server responds by fetching the root URL (e.g., `curl -s -o /dev/null -w "%{http_code}" http://localhost:<PORT>`). If it returns a non-error status, the server is confirmed working.
        5.  If the server fails to start after 30 seconds, inform the user and attempt to debug (check port conflicts, missing dependencies).

        **Step 4b — Present Manual Verification Steps:**
        Once the server is confirmed running, present the user with specific verification instructions. **Always use the worktree's actual port**, not 3000.

        **For a Frontend Change:**
        ```
        The dev server is running and confirmed healthy at http://localhost:<PORT>.

        **Manual Verification Steps:**
        1.  **Open your browser to:** `http://localhost:<PORT>`
        2.  **Confirm that you see:** [specific expected outcome]
        3.  [Additional verification steps...]
        ```

        **For a Backend Change:**
        ```
        The dev server is running and confirmed healthy at http://localhost:<PORT>.

        **Manual Verification Steps:**
        1.  **Execute the following command:** `curl -X POST http://localhost:<PORT>/api/... -d '...'`
        2.  **Confirm that you receive:** [specific expected response]
        ```

    -   **If the phase is NOT user-facing:** Announce "This phase has no user-facing changes — skipping manual verification. Automated tests provide coverage." Then proceed to step 6.

5.  **Await Explicit User Feedback (Only If Step 4 Proposed a Verification Plan):**
    -   After presenting the detailed plan, ask the user for confirmation: "**Does this meet your expectations? Please confirm with yes or provide feedback on what needs to be changed.**"
    -   **PAUSE** and await the user's response. Do not proceed without an explicit yes or confirmation.

6.  **Create Checkpoint Commit (Includes Accumulated Plan Updates):**
    -   Stage all changes, **including the modified `plan.md`** which contains accumulated task status updates from this phase.
    -   Perform the commit with a clear and concise message (e.g., `conductor(checkpoint): Checkpoint end of Phase X`).

7.  **Attach Auditable Verification Report using Git Notes (Optional):**
    -   **Step 7.1: Draft Note Content:** Create a detailed verification report including the automated test command, the manual verification steps, and the user's confirmation.
    -   **Step 7.2: Attach Note:** Use the `git notes` command and the full commit hash from the previous step to attach the full report to the checkpoint commit.
    -   **Note:** This step is optional. If your team prefers not to use git notes, skip this step.

8.  **Get and Record Phase Checkpoint SHA (On Disk Only - Do NOT Commit):**
    -   **Step 8.1: Get Commit Hash:** Obtain the hash of the *just-created checkpoint commit* (`git log -1 --format="%H"`).
    -   **Step 8.2: Update Plan:** Read `plan.md`, find the heading for the completed phase, and append the first 7 characters of the commit hash in the format `[checkpoint: <sha>]`.
    -   **Step 8.3: Write Plan:** Write the updated content back to `plan.md`.
    -   **IMPORTANT:** Do NOT commit this change separately. The checkpoint SHA annotation will be included in the next phase's checkpoint commit, or remain as an uncommitted working state after the final phase.

9.  **Announce Completion:** Inform the user that the phase is complete and the checkpoint has been created.

### Quality Gate

Before marking any task complete, verify that the following are satisfied. Items marked **[auto]** are caught by `npm run check`; remaining items require manual attention.

- **[auto]** All tests pass
- **[auto]** No linting or static analysis errors
- **[auto]** TypeScript strict mode passes (type safety enforced)
- **[auto]** Build succeeds
- Code coverage meets requirements (>80% for new code) — review the coverage text output from the test run
- No security vulnerabilities introduced (no hardcoded secrets, input validation at boundaries, no XSS vectors)
- Works correctly on mobile (if the task touches UI)
- Anti-pattern check passed (see Quality Intelligence below)

### Quality Intelligence

Quality Intelligence runs during the Phase Completion Protocol (step 3) after `npm run check` completes. It consists of two analyses performed by the agent on every phase.

#### Anti-Pattern Detection

After `npm run check` passes, review all files modified in the current phase for common code smells. Flag any findings using the format below.

| Severity | Behavior | Examples |
|----------|----------|----------|
| **Critical** | Blocks task completion — must fix | Security vulnerabilities, credentials in code |
| **High** | Warn user, requires fix or documented skip | God objects (files >400 lines with mixed concerns), deeply nested callbacks (>3 levels), mutable default parameters, duplicated logic blocks |
| **Medium** | Informational — mention but don't block | Magic numbers, overly broad catch blocks, unused imports (if lint missed them) |

**When findings exist, present them to the user:**
```
⚠️ Quality Gate: Anti-Pattern Review

| Severity | File | Line | Issue |
|----------|------|------|-------|
| 🔴 High | src/lib/foo.ts | 45 | God object — mixed data fetching and UI logic |
| 🟡 Medium | src/app/api/bar/route.ts | 23 | Magic number `86400` |

Options: (1) Fix now (2) Skip with documented reason
```

**When skipping a High finding**, record the reason in the track's `decisions.md`.

#### Coverage Intelligence

After `npm run check` produces coverage output (`./coverage/` directory with text, html, and lcov reports):

1. Read the text coverage summary from the test output
2. Identify files modified in the current phase that have below-target coverage (<80%)
3. For each under-covered file, suggest specific functions or branches to test, prioritized by business impact
4. Present findings to the user:

```
### Coverage Intelligence

**Phase Coverage Summary:**
- src/lib/shopping-list-utils.ts: 92% ✅
- src/app/api/shopping-lists/[storeId]/finish-shop/route.ts: 68% ⚠️

**Suggestions:**
1. `POST finish-shop` error handling branches (+8% gain)
   - Missing tests for: invalid storeId, empty checked items, DB write failure
```

5. If overall coverage is below 80%, the agent must create additional tests before proceeding to the checkpoint commit — unless the user explicitly approves skipping with a documented reason

## Development Commands

### Worktree Management (run from main worktree)
```bash
./scripts/worktree-create.sh <branch>   # Create isolated worktree for a track
./scripts/worktree-list.sh              # List all worktrees with ports/databases
./scripts/worktree-remove.sh [branch]   # Remove worktree and optionally drop its database
```

### Setup (run inside your worktree)
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (includes DB setup) — uses worktree's unique port
npm run dev:fast     # Start dev server (skip DB setup)
```

### Daily Development
```bash
npm test             # Run tests (single run)
npm run test:watch   # Run tests (watch mode)
npm run lint         # Lint only
```

### Before Committing / Phase Verification
```bash
npm run check        # Full validation: lint + test + build (REQUIRED before phase review)
```

## Testing Requirements

### Unit Testing
- Every module must have corresponding tests.
- Use appropriate test setup/teardown mechanisms (e.g., fixtures, beforeEach/afterEach).
- Mock external dependencies.
- Test both success and failure cases.

### Integration Testing
- Test complete user flows
- Verify database transactions
- Test authentication and authorization
- Check form submissions

### Mobile Testing
- Test on actual iPhone when possible
- Use Safari developer tools
- Test touch interactions
- Verify responsive layouts
- Check performance on 3G/4G

## Commit Guidelines

### Message Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests
- `chore`: Maintenance tasks

### Examples
```bash
git commit -m "feat(auth): Add remember me functionality"
git commit -m "fix(posts): Correct excerpt generation for short posts"
git commit -m "test(comments): Add tests for emoji reaction limits"
git commit -m "style(mobile): Improve button touch targets"
```

