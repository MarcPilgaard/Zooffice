Analyze what happened in a zooffice instance. Your goal is to reconstruct a clear narrative of what actually happened, identify patterns, and surface insights.

## Data Sources

### 1. Server Logs (primary source)
Server logs are JSONL files in the `logs/` directory, named `zooffice-<timestamp>.jsonl`.
Each line is a JSON object with fields: `t` (ISO timestamp), `cat` (category), plus event-specific fields.

Categories:
- `server`: start/stop, client_connected/disconnected, renderer_connected
- `agent`: register, reconnect, hired, disconnect (fields: id, name, title, role, goal, hiredBy)
- `room`: join, leave, message (fields: room, agent, agentId, text)
- `tool`: execute (fields: agent, agentId, tool, args, cost, success, output, kibbleRemaining)
- `kibble`: credit, debit (fields: agent, agentId, amount, reason, balance)

If the user specifies a log file, use that. Otherwise, list `logs/` and pick the most recent (or largest/most interesting) file. If there are multiple recent files, ask which one to analyze or analyze the latest.

### 2. Docker Container Logs (secondary source)
Each agent client runs in a Docker container named `zooffice-<name-lowercase>` (special chars replaced with `-`).
Container stdio is set to ignore by the spawner, BUT the claude CLI inside the container may produce logs.

Try to collect Docker container logs:
```bash
docker ps -a --filter "name=zooffice-" --format "{{.Names}} {{.Status}}"
docker logs zooffice-<name> 2>&1 | tail -200
```

These may contain Claude CLI output, errors, tool call details, or reasoning that was NOT broadcast to the server. This is valuable supplementary information.

Also check for files agents may have created inside containers using Claude's built-in tools (bypassing `--bash`):
```bash
docker exec zooffice-<name> find /workspace -newer /workspace/.git -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null
```
This catches "ghost work" — files created but never committed or made visible to the server.

### 3. Git History (tertiary source)
If agents were doing development work, check recent git activity:
```bash
git log --all --oneline --since="<session-start-time>" --format="%h %an %s"
```

## Analysis Structure

Produce the analysis in this order:

### Timeline & Narrative
Reconstruct a chronological story of what happened. Focus on decisions, actions, and outcomes rather than raw events. Group related events together (e.g., a hire attempt that failed then succeeded).

### Agent Profiles
For each agent: who they are, what they did, how effective they were. Include:
- Role and goal
- Kibble spent vs remaining
- Tools used and success rate
- Key decisions and contributions
- Whether they actually accomplished anything concrete

### Room Activity
Which rooms existed, who was in them, what was discussed. Highlight key conversations and decisions.

### Kibble Economy
Track the flow of kibble: initial allocations, spending patterns, transfers. Flag any waste (failed tool calls that still cost kibble, excessive talking without action).

### Concrete Outcomes
What was actually produced? Files created, PRs opened, issues resolved, code written. Distinguish between "talking about doing things" and "actually doing things."

### Problems & Anomalies
- Failed tool calls and why
- Agents that disconnected unexpectedly
- Agents that were unproductive (lots of talk, no action)
- Miscommunication (agents not reading each other's messages, duplicated work)
- Agents operating on wrong information (e.g., wrong kibble balance)

### Improvements for Next Analysis
After each analysis, note what additional data would have been useful. Examples:
- Are there log categories missing that would help?
- Should the server log more context (e.g., message delivery confirmation, agent internal state)?
- Would container logs have been useful but weren't available?
- Should there be a structured "outcome" or "deliverable" log category?
- Any patterns that a future automated analysis could detect?

Write these improvement suggestions to `.claude/commands/analyze-improvements.md` (append, don't overwrite) so they accumulate over time. Check that file first to see if past suggestions exist and whether they've been addressed.

## Guidelines
- Be opinionated. Don't just list events — interpret them. Was the session productive? Did the agents make good decisions?
- Quote interesting messages directly when they illustrate a point.
- If agents were delusional (e.g., claiming they have 92 kibble when they have 85), call it out.
- Keep the analysis concise but thorough. A good analysis is one you'd want to read.
- Use the $ARGUMENTS as additional context (e.g., a specific log file path, or "focus on kibble waste").
