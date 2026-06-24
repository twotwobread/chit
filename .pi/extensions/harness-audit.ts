import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { appendFile, mkdir } from "node:fs/promises";
import { basename, isAbsolute, join, relative, sep } from "node:path";

const CUSTOM_TYPE = "harness-audit";
const LOG_DIR_NAME = "harness-audit";
const LOG_FILE_NAME = "events.jsonl";

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

type AssistantCallRecord = {
	provider?: string;
	model?: string;
	stopReason?: string;
	usage: UsageTotals;
};

type AuditRecord = {
	version: 1;
	kind: "request";
	requestId: string;
	cwd: string;
	sessionId?: string;
	sessionFile?: string;
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
	assistantCalls: AssistantCallRecord[];
	requestUsage: UsageTotals;
	sessionUsageAfterRequest: UsageTotals;
	sessionRequestCountAfterRequest: number;
	logFile: string;
};

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

async function appendAuditLog(cwd: string, record: AuditRecord) {
	const logFile = logFileFor(cwd);
	await withFileMutationQueue(logFile, async () => {
		await mkdir(join(cwd, CONFIG_DIR_NAME, LOG_DIR_NAME), { recursive: true });
		await appendFile(logFile, `${JSON.stringify(record)}\n`, "utf8");
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

function usageLine(label: string, usage: UsageTotals): string {
	return `${label}: total=${formatTokens(usage.totalTokens)}, input=${formatTokens(usage.input)}, output=${formatTokens(
		usage.output,
	)}, cacheRead=${formatTokens(usage.cacheRead)}, cacheWrite=${formatTokens(usage.cacheWrite)}, cost=${formatMoney(
		usage.costTotal,
	)}`;
}

function updateStatus(ctx: { ui: any }, requestCount: number, usage: UsageTotals) {
	ctx.ui.setStatus(
		CUSTOM_TYPE,
		`audit ${requestCount} req · ${formatTokens(usage.totalTokens)} tok · ${formatMoney(usage.costTotal)}`,
	);
}

function restoreSessionState(entries: readonly any[]) {
	const usage = emptyUsage();
	let requestCount = 0;
	let lastRecord: AuditRecord | undefined;

	for (const entry of entries) {
		if (entry?.type === "message" && entry.message?.role === "assistant") {
			addUsage(usage, toUsage(entry.message.usage));
			continue;
		}

		if (entry?.type !== "custom" || entry.customType !== CUSTOM_TYPE) continue;
		const data = entry.data as AuditRecord | undefined;
		if (data?.kind !== "request") continue;
		requestCount += 1;
		lastRecord = data;
	}

	return { usage, requestCount, lastRecord };
}

export default function harnessAudit(pi: ExtensionAPI) {
	let sessionUsage = emptyUsage();
	let sessionRequestCount = 0;
	let current: InFlightRequest | undefined;
	let lastRecord: AuditRecord | undefined;
	let pendingInvokedSkills: DocumentRecord[] = [];

	pi.on("session_start", async (_event, ctx) => {
		const restored = restoreSessionState(ctx.sessionManager.getBranch());
		sessionUsage = restored.usage;
		sessionRequestCount = restored.requestCount;
		lastRecord = restored.lastRecord;
		pendingInvokedSkills = [];
		current = undefined;
		updateStatus(ctx, sessionRequestCount, sessionUsage);
	});

	pi.on("input", async (event, ctx) => {
		const match = event.text.trim().match(/^\/skill:([^\s]+)(?:\s|$)/);
		if (!match) return;

		pendingInvokedSkills.push(documentRecord(ctx.cwd, `skill:${match[1]}`, "skill-command"));
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const now = Date.now();
		const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined;
		const contextFiles = event.systemPromptOptions.contextFiles ?? [];
		const skills = event.systemPromptOptions.skills ?? [];

		current = {
			requestId: `${now}-${Math.random().toString(16).slice(2, 8)}`,
			cwd: ctx.cwd,
			sessionId: ctx.sessionManager.getSessionId(),
			sessionFile: ctx.sessionManager.getSessionFile(),
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
			assistantCalls: [],
			requestUsage: emptyUsage(),
		};
		pendingInvokedSkills = [];
	});

	pi.on("tool_result", async (event, ctx) => {
		if (!current || event.toolName !== "read" || event.isError) return;

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
		sessionRequestCount += 1;

		const logFile = logFileFor(ctx.cwd);
		const record: AuditRecord = {
			version: 1,
			kind: "request",
			requestId: current.requestId,
			cwd: current.cwd,
			sessionId: current.sessionId,
			sessionFile: current.sessionFile,
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
			assistantCalls: current.assistantCalls,
			requestUsage: current.requestUsage,
			sessionUsageAfterRequest: { ...sessionUsage },
			sessionRequestCountAfterRequest: sessionRequestCount,
			logFile,
		};

		lastRecord = record;
		pi.appendEntry(CUSTOM_TYPE, record);
		await appendAuditLog(ctx.cwd, record);
		updateStatus(ctx, sessionRequestCount, sessionUsage);
		current = undefined;
	});

	pi.registerCommand("harness-audit", {
		description: "Show harness audit token totals and recently read docs",
		handler: async (_args, ctx) => {
			const restored = restoreSessionState(ctx.sessionManager.getBranch());
			sessionUsage = restored.usage;
			sessionRequestCount = restored.requestCount;
			lastRecord = restored.lastRecord ?? lastRecord;
			updateStatus(ctx, sessionRequestCount, sessionUsage);

			const lines = [
				`Harness audit log: ${displayPath(ctx.cwd, logFileFor(ctx.cwd))}`,
				`Audited requests in current branch: ${sessionRequestCount}`,
				usageLine("Session", sessionUsage),
			];

			if (lastRecord) {
				lines.push("", usageLine("Last request", lastRecord.requestUsage));
				const docs = [...lastRecord.contextFiles, ...lastRecord.invokedSkills, ...lastRecord.readDocuments];
				if (docs.length > 0) {
					lines.push("Last request docs:");
					for (const doc of docs.slice(0, 20)) {
						lines.push(`- [${doc.category}/${doc.via}] ${doc.path}`);
					}
					if (docs.length > 20) lines.push(`- ... ${docs.length - 20} more`);
				}
			}

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
