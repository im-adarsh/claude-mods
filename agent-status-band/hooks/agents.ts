/**
 * Attribution decision (resolved by experiment, see Task 1 of the
 * implementation plan): tool.check's real event payload DID NOT carry
 * per-agent identity.
 *
 * Dispositive evidence (static): `ToolCheckInput` (this build's generated
 * `claude-code` types) is `{ tool, input, tool_use_id? }` with no
 * `AgentLoop` mixin, unlike `ToolCallInput`, which is explicitly
 * `ToolCallEnvelope & AgentLoop` and so carries `agentId`. This type is
 * the same for both of `tool.check`'s two paths — a manual query
 * (`$.tool.check`) and a real engine-dispatched call (deciding an actual
 * tool use); only `tool_use_id`'s presence/absence differs between those
 * two cases per the type's own doc comment ("on a real call only; absent
 * on a query"), not `agentId`, which the type lacks in both cases. So the
 * type evidence alone settles this regardless of which path is observed.
 *
 * Corroborating evidence (dynamic, query path only): a throwaway `claude
 * plugin test` diagnostic (an inline test plugin's `agent.spawn` handler
 * calling `$.tool.check` directly, not a live engine-dispatched call)
 * logged the real `e` it received as exactly
 * `{ tool: "Read", input: { file_path: "package.json" } }` — no
 * `agentId`, `agent_id`, or anything else beyond the documented shape.
 * This confirms the query path only; `claude plugin test`'s harness has
 * no real subagent loop to drive, so no real-call capture was obtainable
 * there. The static evidence above is what covers the real-call path.
 *
 * Consequence: statusDotOf in derive.ts uses the degraded fallback — a
 * binary colored/dim dot, no per-agent yellow/red distinction — and only
 * the aggregate light gets real ask/deny colors. tool_use_id correlation
 * against tool.call (which does carry agentId) was considered and
 * rejected as a fallback: tool.call only fires once a call is already
 * allowed to proceed, so it never fires for the ask/deny cases that are
 * the ones needing per-agent attribution in the first place.
 */
