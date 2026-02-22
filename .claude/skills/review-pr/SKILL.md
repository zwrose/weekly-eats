---
name: review-pr
description: Comprehensively review a pull request using specialized review agents
---

Review a pull request by orchestrating multiple specialized agents in parallel.

## Arguments

`/review-pr <number>` — e.g., `/review-pr 42`

If no number is provided, review the current branch's open PR.

## Workflow

### Step 1: Gather PR context

Use the GitHub MCP tools to fetch the PR:

```
mcp__plugin_github_github__pull_request_read (method: "get", owner/repo from git remote, pullNumber from argument)
mcp__plugin_github_github__pull_request_read (method: "get_diff", same params)
mcp__plugin_github_github__pull_request_read (method: "get_files", same params)
```

### Step 2: Dispatch review agents in parallel

Launch these agents simultaneously using the Task tool with `subagent_type`:

1. **code-reviewer** (`superpowers:code-reviewer`) — General code quality and convention adherence
2. **security-reviewer** (`superpowers:code-reviewer`) — Auth bypass, injection, IDOR, input validation (use `.claude/agents/security-reviewer.md` instructions)
3. **a11y-reviewer** (`superpowers:code-reviewer`) — Accessibility review for any component changes (use `.claude/agents/a11y-reviewer.md` instructions)
4. **test-reviewer** (`superpowers:code-reviewer`) — Test quality review for any test file changes

Provide each agent with:

- The PR diff (full or relevant portions)
- The list of changed files
- The PR description for context
- The agent-specific instructions from `.claude/agents/`

Skip agents that aren't relevant (e.g., skip a11y-reviewer if no component files changed, skip test-reviewer if no test files changed).

### Step 3: Consolidate and report

Combine findings into a single report organized by severity:

```markdown
## PR Review: #<number> — <title>

### Critical Issues

- [list or "None found"]

### High Severity

- [list or "None found"]

### Medium Severity

- [list or "None found"]

### Low Severity

- [list or "None found"]

### Summary

[1-2 sentence overall assessment]
```

Present the report to the user. Do NOT post comments on the PR unless explicitly asked.
