import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { appendFile, mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";

const CUSTOM_TYPE = "harness-audit";
const LOG_DIR_NAME = "harness-audit";
const LOG_FILE_NAME = "events.jsonl";
const LOG_ROTATE_BYTES = 10 * 1024 * 1024;
const LOG_ROTATE_KEEP = 5;
const FOOTER_REFRESH_MS = 30_000;

type UsageTotals = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	costTotal: number;
};

type DocumentCategory = "skill" | "rule" | "feature" | "pi-doc" | "markdown" | "other";

type DocumentRecord = {
	path: string;
	category: DocumentCategory;
	via: "context" | "read" | "skill-command";
};

type SkillRecord = {
	name: string;
	path?: string;
	source?: string;
};

type ToolCallRecord = {
	name: string;
	isError: boolean;
	elapsedMs?: number;
};

type AssistantCallRecord = {
	provider?: string;
	model?: string;
	stopReason?: string;
	usage: UsageTotals;
};

type AuditRecord = {
	version: 2;
	kind: "request";
	requestId: string;
	cwd: string;
	sessionId?: string;
	sessionFile?: string;
	sessionOpenedAt?: string;
	sessionElapsedMsAfterRequest?: number;
	startedAt: string;
	endedAt: string;
	elapsedMs: number;
	model?: string;
	promptChars: number;
	promptPreview: string;
	contextUsageAtStart?: unknown;
	contextUsageAtEnd?: unknown;
	contextFiles: DocumentRecord[];
	availableSkills: SkillRecord[];
	invokedSkills: DocumentRecord[];
	readDocuments: DocumentRecord[];
	toolCalls: ToolCallRecord[];
	assistantCalls: AssistantCallRecord[];
	requestUsage: UsageTotals;
	sessionUsageAfterRequest: UsageTotals;
	sessionRequestCountAfterRequest: number;
	logFile: string;
};

type RequestSummaryRecord = {
	version: 2;
	kind: "request-summary";
	requestId: string;
	cwd: string;
	sessionId?: string;
	sessionFile?: string;
	startedAt: string;
	endedAt: string;
	elapsedMs: number;
	model?: string;
	requestUsage: UsageTotals;
	sessionUsageAfterRequest: UsageTotals;
	sessionRequestCountAfterRequest: number;
	logFile: string;
};

type SessionSummaryRecord = {
	version: 2;
	kind: "session-summary";
	cwd: string;
	sessionId?: string;
	sessionFile?: string;
	openedAt: string;
	closedAt: string;
	elapsedMs: number;
	reason: string;
	openRequestCount: number;
	branchRequestCount: number;
	openUsage: UsageTotals;
	branchUsage: UsageTotals;
	toolCalls: Record<string, number>;
	toolErrors: Record<string, number>;
	invokedSkills: Record<string, number>;
	readDocumentCategories: Record<string, number>;
	logFile: string;
};

type StoredAuditRecord = AuditRecord | RequestSummaryRecord;
type AuditLogRecord = AuditRecord | SessionSummaryRecord;

type InFlightRequest = Omit<
	AuditRecord,
	"kind" | "version" | "endedAt" | "elapsedMs" | "sessionUsageAfterRequest" | "sessionRequestCountAfterRequest" | "logFile"
> & {
	startedAtMs: number;
};

const emptyUsage = (): UsageTotals => ({
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 0,
	costTotal: 0,
});

function cloneUsage(usage: UsageTotals): UsageTotals {
	return { ...usage };
}

function addUsage(target: UsageTotals, usage?: Partial<UsageTotals>) {
	if (!usage) return;
	target.input += usage.input ?? 0;
	target.output += usage.output ?? 0;
	target.cacheRead += usage.cacheRead ?? 0;
	target.cacheWrite += usage.cacheWrite ?? 0;
	target.totalTokens += usage.totalTokens ?? 0;
	target.costTotal += usage.costTotal ?? 0;
}

function toUsage(raw: any): UsageTotals {
	return {
		input: Number(raw?.input ?? 0),
		output: Number(raw?.output ?? 0),
		cacheRead: Number(raw?.cacheRead ?? 0),
		cacheWrite: Number(raw?.cacheWrite ?? 0),
		totalTokens: Number(raw?.totalTokens ?? 0),
		costTotal: Number(raw?.cost?.total ?? raw?.costTotal ?? 0),
	};
}

function uniqByPath<T extends { path: string; via?: string }>(records: T[]): T[] {
	const seen = new Set<string>();
	const result: T[] = [];

	for (const record of records) {
		const key = `${record.via ?? ""}:${record.path}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(record);
	}

	return result;
}

function displayPath(cwd: string, path: string): string {
	if (!path) return path;
	if (!isAbsolute(path)) return path;

	const rel = relative(cwd, path);
	if (rel && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel)) {
		return rel;
	}

	return path;
}

function classifyDocument(path: string): DocumentCategory {
	const normalized = path.replaceAll("\\", "/");
	const name = basename(normalized);

	if (normalized.startsWith("skill:")) return "skill";
	if (normalized.startsWith("docs/features/") || normalized.includes("/docs/features/")) return "feature";
	if (
		normalized.startsWith(".pi/skills/") ||
		normalized.startsWith(".agents/skills/") ||
		normalized.includes("/.pi/skills/") ||
		normalized.includes("/.agents/skills/") ||
		name === "SKILL.md"
	) {
		return "skill";
	}
	if (
		name === "AGENTS.md" ||
		name === "CLAUDE.md" ||
		normalized.startsWith(".pi/rules/") ||
		normalized.startsWith(".claude/rules/") ||
		normalized.includes("/.pi/rules/") ||
		normalized.includes("/.claude/rules/")
	) {
		return "rule";
	}
	if (normalized.includes("/pi-coding-agent/docs/") || normalized.includes("/pi-coding-agent/README.md")) return "pi-doc";
	if (name.endsWith(".md") || name.endsWith(".mdx")) return "markdown";

	return "other";
}

function documentRecord(cwd: string, path: string, via: DocumentRecord["via"]): DocumentRecord {
	const displayed = displayPath(cwd, path);
	return {
		path: displayed,
		category: classifyDocument(displayed),
		via,
	};
}

function logFileFor(cwd: string): string {
	return join(cwd, CONFIG_DIR_NAME, LOG_DIR_NAME, LOG_FILE_NAME);
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error: any) {
		if (error?.code === "ENOENT") return false;
		throw error;
	}
}

function rotatedLogName(now = new Date()): string {
	const timestamp = now.toISOString().replaceAll(":", "-").replaceAll(".", "-");
	const suffix = Math.random().toString(16).slice(2, 8);
	return `events.${timestamp}.${process.pid}.${suffix}.jsonl`;
}

async function pruneRotatedLogs(logDir: string) {
	const entries = await readdir(logDir, { withFileTypes: true });
	const rotated = entries
		.filter((entry) => entry.isFile() && /^events\..+\.jsonl$/.test(entry.name))
		.map((entry) => entry.name)
		.sort()
		.reverse();

	for (const stale of rotated.slice(LOG_ROTATE_KEEP)) {
		await unlink(join(logDir, stale)).catch((error: any) => {
			if (error?.code !== "ENOENT") throw error;
		});
	}
}

async function rotateAuditLogIfNeeded(logFile: string, nextLineBytes: number) {
	const info = await stat(logFile).catch((error: any) => {
		if (error?.code === "ENOENT") return undefined;
		throw error;
	});
	if (!info || info.size === 0 || info.size + nextLineBytes <= LOG_ROTATE_BYTES) return;

	const logDir = dirname(logFile);
	let rotatedPath = join(logDir, rotatedLogName());
	while (await pathExists(rotatedPath)) {
		rotatedPath = join(logDir, rotatedLogName());
	}

	await rename(logFile, rotatedPath);
	await pruneRotatedLogs(logDir);
}

async function appendAuditLog(cwd: string, record: AuditLogRecord) {
	const logFile = logFileFor(cwd);
	const line = `${JSON.stringify(record)}\n`;
	await withFileMutationQueue(logFile, async () => {
		await mkdir(join(cwd, CONFIG_DIR_NAME, LOG_DIR_NAME), { recursive: true });
		await rotateAuditLogIfNeeded(logFile, Buffer.byteLength(line, "utf8"));
		await appendFile(logFile, line, "utf8");
	});
}

function formatTokens(tokens: number): string {
	if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
	if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
	return String(tokens);
}

function formatMoney(cost: number): string {
	if (!Number.isFinite(cost) || cost <= 0) return "$0";
	return `$${cost.toFixed(4)}`;
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const seconds = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const minutes = totalMinutes % 60;
	const totalHours = Math.floor(totalMinutes / 60);
	const hours = totalHours % 24;
	const days = Math.floor(totalHours / 24);

	if (days > 0) return `${days}d ${hours}h`;
	if (totalHours > 0) return `${totalHours}h ${minutes}m`;
	if (totalMinutes > 0) return `${totalMinutes}m ${seconds}s`;
	return `${seconds}s`;
}

function usageLine(label: string, usage: UsageTotals): string {
	return `${label}: total=${formatTokens(usage.totalTokens)}, input=${formatTokens(usage.input)}, output=${formatTokens(
		usage.output,
	)}, cacheRead=${formatTokens(usage.cacheRead)}, cacheWrite=${formatTokens(usage.cacheWrite)}, cost=${formatMoney(
		usage.costTotal,
	)}`;
}

function incrementCount(map: Map<string, number>, key: string, by = 1) {
	if (!key) return;
	map.set(key, (map.get(key) ?? 0) + by);
}

function sortedCountEntries(counts: Map<string, number> | Record<string, number>): [string, number][] {
	const entries = counts instanceof Map ? [...counts.entries()] : Object.entries(counts);
	return entries.filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function countMapToRecord(map: Map<string, number>): Record<string, number> {
	return Object.fromEntries(sortedCountEntries(map));
}

function formatCountList(counts: Map<string, number> | Record<string, number>, limit = 8): string {
	const entries = sortedCountEntries(counts);
	if (entries.length === 0) return "none";

	const rendered = entries.slice(0, limit).map(([name, count]) => `${name}×${count}`);
	if (entries.length > limit) rendered.push(`+${entries.length - limit} more`);
	return rendered.join(", ");
}

function countTools(toolCalls: readonly ToolCallRecord[] | undefined): Map<string, number> {
	const counts = new Map<string, number>();
	for (const toolCall of toolCalls ?? []) {
		incrementCount(counts, toolCall.name);
	}
	return counts;
}

function updateStatus(ctx: { ui: any }, requestCount: number, usage: UsageTotals, elapsedMs: number) {
	ctx.ui.setStatus(
		CUSTOM_TYPE,
		`audit ${requestCount} req · ${formatTokens(usage.totalTokens)} tok · ${formatMoney(usage.costTotal)} · ${formatDuration(
			elapsedMs,
		)}`,
	);
}

function restoreSessionState(entries: readonly any[]) {
	const usage = emptyUsage();
	let requestCount = 0;
	let lastRecord: StoredAuditRecord | undefined;

	for (const entry of entries) {
		if (entry?.type === "message" && entry.message?.role === "assistant") {
			addUsage(usage, toUsage(entry.message.usage));
			continue;
		}

		if (entry?.type !== "custom" || entry.customType !== CUSTOM_TYPE) continue;
		const data = entry.data as StoredAuditRecord | undefined;
		if (data?.kind !== "request" && data?.kind !== "request-summary") continue;
		requestCount += 1;
		lastRecord = data;
	}

	return { usage, requestCount, lastRecord };
}

function toRequestSummary(record: AuditRecord): RequestSummaryRecord {
	return {
		version: 2,
		kind: "request-summary",
		requestId: record.requestId,
		cwd: record.cwd,
		sessionId: record.sessionId,
		sessionFile: record.sessionFile,
		startedAt: record.startedAt,
		endedAt: record.endedAt,
		elapsedMs: record.elapsedMs,
		model: record.model,
		requestUsage: cloneUsage(record.requestUsage),
		sessionUsageAfterRequest: cloneUsage(record.sessionUsageAfterRequest),
		sessionRequestCountAfterRequest: record.sessionRequestCountAfterRequest,
		logFile: record.logFile,
	};
}

function formatSessionSummary(cwd: string, summary: SessionSummaryRecord): string {
	const lines = [
		`Harness audit summary (${summary.reason})`,
		`Open elapsed: ${formatDuration(summary.elapsedMs)}`,
		`Requests this open: ${summary.openRequestCount} (branch total: ${summary.branchRequestCount})`,
		usageLine("This open", summary.openUsage),
	];

	if (summary.branchRequestCount !== summary.openRequestCount) {
		lines.push(usageLine("Branch", summary.branchUsage));
	}

	lines.push(`Tools this open: ${formatCountList(summary.toolCalls)}`);

	if (sortedCountEntries(summary.toolErrors).length > 0) {
		lines.push(`Tool errors: ${formatCountList(summary.toolErrors)}`);
	}
	if (sortedCountEntries(summary.invokedSkills).length > 0) {
		lines.push(`Invoked skills: ${formatCountList(summary.invokedSkills)}`);
	}
	if (sortedCountEntries(summary.readDocumentCategories).length > 0) {
		lines.push(`Docs read by category: ${formatCountList(summary.readDocumentCategories)}`);
	}

	lines.push(`Full log: ${displayPath(cwd, summary.logFile)}`);
	return lines.join("\n");
}

export default function harnessAudit(pi: ExtensionAPI) {
	let sessionUsage = emptyUsage();
	let sessionRequestCount = 0;
	let current: InFlightRequest | undefined;
	let lastRecord: StoredAuditRecord | undefined;
	let pendingInvokedSkills: DocumentRecord[] = [];
	let sessionOpenedAtMs = 0;
	let openUsage = emptyUsage();
	let openRequestCount = 0;
	let openToolCounts = new Map<string, number>();
	let openToolErrorCounts = new Map<string, number>();
	let openInvokedSkillCounts = new Map<string, number>();
	let openReadDocumentCategoryCounts = new Map<string, number>();
	let toolStartedAt = new Map<string, number>();
	let statusTimer: ReturnType<typeof setInterval> | undefined;

	const openElapsedMs = () => (sessionOpenedAtMs > 0 ? Date.now() - sessionOpenedAtMs : 0);

	const stopStatusTimer = () => {
		if (!statusTimer) return;
		clearInterval(statusTimer);
		statusTimer = undefined;
	};

	const startStatusTimer = (ctx: { mode?: string; ui: any }) => {
		stopStatusTimer();
		if (ctx.mode !== "tui") return;

		statusTimer = setInterval(() => updateStatus(ctx, sessionRequestCount, sessionUsage, openElapsedMs()), FOOTER_REFRESH_MS);
		(statusTimer as { unref?: () => void }).unref?.();
	};

	const buildSessionSummary = (ctx: any, reason: string, closedAtMs: number): SessionSummaryRecord => {
		const openedAtMs = sessionOpenedAtMs || closedAtMs;
		return {
			version: 2,
			kind: "session-summary",
			cwd: ctx.cwd,
			sessionId: ctx.sessionManager.getSessionId(),
			sessionFile: ctx.sessionManager.getSessionFile(),
			openedAt: new Date(openedAtMs).toISOString(),
			closedAt: new Date(closedAtMs).toISOString(),
			elapsedMs: Math.max(0, closedAtMs - openedAtMs),
			reason,
			openRequestCount,
			branchRequestCount: sessionRequestCount,
			openUsage: cloneUsage(openUsage),
			branchUsage: cloneUsage(sessionUsage),
			toolCalls: countMapToRecord(openToolCounts),
			toolErrors: countMapToRecord(openToolErrorCounts),
			invokedSkills: countMapToRecord(openInvokedSkillCounts),
			readDocumentCategories: countMapToRecord(openReadDocumentCategoryCounts),
			logFile: logFileFor(ctx.cwd),
		};
	};

	pi.on("session_start", async (_event, ctx) => {
		const restored = restoreSessionState(ctx.sessionManager.getBranch());
		sessionUsage = restored.usage;
		sessionRequestCount = restored.requestCount;
		lastRecord = restored.lastRecord;
		pendingInvokedSkills = [];
		current = undefined;
		sessionOpenedAtMs = Date.now();
		openUsage = emptyUsage();
		openRequestCount = 0;
		openToolCounts = new Map<string, number>();
		openToolErrorCounts = new Map<string, number>();
		openInvokedSkillCounts = new Map<string, number>();
		openReadDocumentCategoryCounts = new Map<string, number>();
		toolStartedAt = new Map<string, number>();
		updateStatus(ctx, sessionRequestCount, sessionUsage, 0);
		startStatusTimer(ctx);
	});

	pi.on("session_shutdown", async (event, ctx) => {
		stopStatusTimer();
		const summary = buildSessionSummary(ctx, event.reason, Date.now());
		await appendAuditLog(ctx.cwd, summary);

		if (event.reason !== "reload" && ctx.mode === "tui") {
			ctx.ui.notify(formatSessionSummary(ctx.cwd, summary), "info");
		}

		ctx.ui.setStatus(CUSTOM_TYPE, undefined);
	});

	pi.on("input", async (event, ctx) => {
		const match = event.text.trim().match(/^\/skill:([^\s]+)(?:\s|$)/);
		if (!match) return;

		pendingInvokedSkills.push(documentRecord(ctx.cwd, `skill:${match[1]}`, "skill-command"));
	});

	pi.on("before_agent_start", async (event, ctx) => {
		toolStartedAt.clear();
		const now = Date.now();
		const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;
		const contextFiles = event.systemPromptOptions.contextFiles ?? [];
		const skills = event.systemPromptOptions.skills ?? [];

		current = {
			requestId: `${now}-${Math.random().toString(16).slice(2, 8)}`,
			cwd: ctx.cwd,
			sessionId: ctx.sessionManager.getSessionId(),
			sessionFile: ctx.sessionManager.getSessionFile(),
			sessionOpenedAt: sessionOpenedAtMs > 0 ? new Date(sessionOpenedAtMs).toISOString() : undefined,
			startedAt: new Date(now).toISOString(),
			startedAtMs: now,
			model,
			promptChars: event.prompt.length,
			promptPreview: event.prompt.slice(0, 200),
			contextUsageAtStart: ctx.getContextUsage(),
			contextUsageAtEnd: undefined,
			contextFiles: uniqByPath(contextFiles.map((file) => documentRecord(ctx.cwd, file.path, "context"))),
			availableSkills: skills.map((skill) => ({
				name: skill.name,
				path: displayPath(ctx.cwd, skill.filePath),
				source: skill.sourceInfo?.source,
			})),
			invokedSkills: uniqByPath(pendingInvokedSkills),
			readDocuments: [],
			toolCalls: [],
			assistantCalls: [],
			requestUsage: emptyUsage(),
		};
		pendingInvokedSkills = [];
	});

	pi.on("tool_execution_start", async (event) => {
		toolStartedAt.set(event.toolCallId, Date.now());
	});

	pi.on("tool_result", async (event, ctx) => {
		if (!current) return;

		const startedAt = toolStartedAt.get(event.toolCallId);
		current.toolCalls.push({
			name: event.toolName,
			isError: Boolean(event.isError),
			elapsedMs: startedAt === undefined ? undefined : Date.now() - startedAt,
		});
		toolStartedAt.delete(event.toolCallId);

		if (event.toolName !== "read" || event.isError) return;

		const path = event.input?.path;
		if (typeof path !== "string") return;

		current.readDocuments = uniqByPath([...current.readDocuments, documentRecord(ctx.cwd, path, "read")]);
	});

	pi.on("message_end", async (event) => {
		if (!current || event.message.role !== "assistant") return;

		const usage = toUsage(event.message.usage);
		addUsage(current.requestUsage, usage);
		current.assistantCalls.push({
			provider: event.message.provider,
			model: event.message.model,
			stopReason: event.message.stopReason,
			usage,
		});
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!current) return;

		const endedAtMs = Date.now();
		addUsage(sessionUsage, current.requestUsage);
		addUsage(openUsage, current.requestUsage);
		sessionRequestCount += 1;
		openRequestCount += 1;

		for (const toolCall of current.toolCalls) {
			incrementCount(openToolCounts, toolCall.name);
			if (toolCall.isError) incrementCount(openToolErrorCounts, toolCall.name);
		}
		for (const skill of current.invokedSkills) {
			incrementCount(openInvokedSkillCounts, skill.path.replace(/^skill:/, ""));
		}
		for (const doc of uniqByPath(current.readDocuments)) {
			incrementCount(openReadDocumentCategoryCounts, doc.category);
		}

		const logFile = logFileFor(ctx.cwd);
		const record: AuditRecord = {
			version: 2,
			kind: "request",
			requestId: current.requestId,
			cwd: current.cwd,
			sessionId: current.sessionId,
			sessionFile: current.sessionFile,
			sessionOpenedAt: current.sessionOpenedAt,
			sessionElapsedMsAfterRequest: sessionOpenedAtMs > 0 ? endedAtMs - sessionOpenedAtMs : undefined,
			startedAt: current.startedAt,
			endedAt: new Date(endedAtMs).toISOString(),
			elapsedMs: endedAtMs - current.startedAtMs,
			model: current.model,
			promptChars: current.promptChars,
			promptPreview: current.promptPreview,
			contextUsageAtStart: current.contextUsageAtStart,
			contextUsageAtEnd: ctx.getContextUsage(),
			contextFiles: current.contextFiles,
			availableSkills: current.availableSkills,
			invokedSkills: current.invokedSkills,
			readDocuments: uniqByPath(current.readDocuments),
			toolCalls: current.toolCalls,
			assistantCalls: current.assistantCalls,
			requestUsage: current.requestUsage,
			sessionUsageAfterRequest: cloneUsage(sessionUsage),
			sessionRequestCountAfterRequest: sessionRequestCount,
			logFile,
		};

		lastRecord = record;
		pi.appendEntry(CUSTOM_TYPE, toRequestSummary(record));
		await appendAuditLog(ctx.cwd, record);
		updateStatus(ctx, sessionRequestCount, sessionUsage, openElapsedMs());
		current = undefined;
	});

	pi.registerCommand("harness-audit", {
		description: "Show harness audit elapsed time, token totals, tools, and recently read docs",
		handler: async (_args, ctx) => {
			const restored = restoreSessionState(ctx.sessionManager.getBranch());
			sessionUsage = restored.usage;
			sessionRequestCount = restored.requestCount;
			lastRecord = restored.lastRecord ?? lastRecord;
			updateStatus(ctx, sessionRequestCount, sessionUsage, openElapsedMs());

			const lines = [
				`Harness audit log: ${displayPath(ctx.cwd, logFileFor(ctx.cwd))}`,
				`Open elapsed: ${formatDuration(openElapsedMs())}`,
				`Requests this open: ${openRequestCount}`,
				usageLine("This open", openUsage),
				`Audited requests in current branch: ${sessionRequestCount}`,
				usageLine("Branch", sessionUsage),
				`Tools this open: ${formatCountList(openToolCounts)}`,
			];

			if (sortedCountEntries(openInvokedSkillCounts).length > 0) {
				lines.push(`Invoked skills this open: ${formatCountList(openInvokedSkillCounts)}`);
			}
			if (sortedCountEntries(openReadDocumentCategoryCounts).length > 0) {
				lines.push(`Docs read by category this open: ${formatCountList(openReadDocumentCategoryCounts)}`);
			}

			if (lastRecord) {
				lines.push("", usageLine("Last request", lastRecord.requestUsage));

				if (lastRecord.kind === "request" && (lastRecord.toolCalls?.length ?? 0) > 0) {
					lines.push(`Last request tools: ${formatCountList(countTools(lastRecord.toolCalls))}`);
				}

				if (lastRecord.kind === "request") {
					const docs = [...lastRecord.contextFiles, ...lastRecord.invokedSkills, ...lastRecord.readDocuments];
					if (docs.length > 0) {
						lines.push("Last request docs:");
						for (const doc of docs.slice(0, 20)) {
							lines.push(`- [${doc.category}/${doc.via}] ${doc.path}`);
						}
						if (docs.length > 20) lines.push(`- ... ${docs.length - 20} more`);
					}
				}
			}

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
