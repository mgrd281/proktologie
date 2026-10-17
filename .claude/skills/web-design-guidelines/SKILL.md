---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Fetch the latest guidelines from the source URL below
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Read the guidelines from the local, pinned copy next to this file:

```
.claude/skills/web-design-guidelines/guidelines.md
```

It contains all the rules and output format instructions (pinned copy of vercel-labs/web-interface-guidelines, see .claude/skills/VENDOR.md). Do not fetch a remote version.

## Usage

When a user provides a file or pattern argument:
1. Read the guidelines from the local file above
2. Read the specified files
3. Apply all rules from the guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
