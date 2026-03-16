# Analyze Improvements Log

Suggestions accumulated from running /analyze on zooffice sessions. Check these when improving the analyze skill or the server logging.

---

## 2026-03-17 — Session 2026-03-16T22:59 (Quill deadlock)

### Server-side improvements

1. ~~**Transfer-kibble should notify the recipient.**~~ **FIXED** — `sendToAgent` now called after credit.

2. ~~**Log a `kibble` category for transfers.**~~ **FIXED** — `kibble` log category added for all credits/debits with balance.

3. **Add stuck-agent detection.** If an agent has been idle (no tool calls) for N minutes while it has pending work context, the server should log a warning or ping the agent. This deadlock was invisible from the server's perspective. *(Deferred)*

4. ~~**Log agent kibble balance on registration and on every balance change.**~~ **FIXED** — logged via `kibble` category on credit/debit.

### Client-side improvements

5. **Plain-text responses should auto-wrap in `--talk`.** When Claude responds with prose that contains no tool calls, the bridge should consider auto-posting it to the agent's current room (or as a DM to whoever last messaged them). Silent responses are a usability black hole. *(Deferred)*

6. **Claude's built-in file tools bypass the kibble economy.** With `--dangerously-skip-permissions`, Claude can Read/Write files freely without using `--bash`. This lets agents do work "for free" but in the wrong context (container filesystem vs host). Consider: (a) restricting Claude's allowed tools, or (b) setting the working directory to match the host mount so at least the work lands in the right place. *(Deferred)*

### Analysis skill improvements

7. **Docker container logs were essential.** Always check container logs for silent agents. *(Note — already in analyze.md)*

8. ~~**Correlate container log timestamps with server log timestamps.**~~ **FIXED** — bridge and claude-wrapper now log ISO timestamps.

9. ~~**Check for files created inside containers.**~~ **FIXED** — added `docker exec find` step to analyze.md.

10. **Detect "believed vs actual" kibble discrepancies.** Parse agent messages for kibble amount claims and compare against the server-side balance. Agents operating on wrong information is a high-signal anomaly. *(Deferred)*
