/**
 * Attribution decision (resolved by experiment, see Task 1 of the
 * implementation plan): tool.check's real event payload DID NOT carry
 * per-agent identity.
 *
 * Evidence: `ToolCheckInput` (this build's generated `claude-code` types)
 * is `{ tool, input, tool_use_id? }` with no `AgentLoop` mixin, unlike
 * `ToolCallInput`, which is explicitly `ToolCallEnvelope & AgentLoop` and
 * so carries `agentId`. A throwaway `claude plugin test` diagnostic (an
 * inline test plugin's `agent.spawn` hook calling `$.tool.check` from
 * within the spawn) confirmed this at runtime: the logged `e` was exactly
 * `{ tool: "Read", input: { file_path: "package.json" } }` — no
 * `agentId`, `agent_id`, or anything else beyond the documented shape.
 *
 * Consequence: statusDotOf in derive.ts uses the degraded fallback — a
 * binary colored/dim dot, no per-agent yellow/red distinction — and only
 * the aggregate light gets real ask/deny colors. tool_use_id correlation
 * against tool.call (which does carry agentId) was considered and
 * rejected as a fallback: tool.call only fires once a call is already
 * allowed to proceed, so it never fires for the ask/deny cases that are
 * the ones needing per-agent attribution in the first place.
 */
