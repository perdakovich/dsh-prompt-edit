import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { buildPlatformSeed } from "./compat.host.js";
import crypto from "node:crypto";

const SERVICE_KEY = "promptEdit";
const TURN_END = "turn/end";
const USER_MESSAGE = "user/message";

export default class PromptEditService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, SERVICE_KEY);
    this.pendingArchives = new Map();
  }

  async resolve(sessionId, seq, text) {
    let observed = undefined;
    try {
      if (
        typeof sessionId !== "string" ||
        typeof seq !== "number" ||
        !Number.isFinite(seq) ||
        seq < 0 ||
        typeof text !== "string"
      ) {
        return { ok: false, error: "Invalid parameters" };
      }
      const targetSeq = Math.floor(seq);

      const sessionQuery = this.ctx.get("sessionQuery");
      if (sessionQuery === undefined) return { ok: false, error: "Session query service unavailable" };

      // use observeSession instead of readSession:
      // readSession has an upstream bug in DSH where it calls Session.create instead of Session.fromRestore on seeded sessions
      observed = await sessionQuery.observeSession(sessionId);
      if (!observed || !Array.isArray(observed.events)) {
        return { ok: false, error: "Session not found or has no events" };
      }
      const events = observed.events;

      const target = events.find(
        (event) =>
          event.seq === targetSeq &&
          event.type === USER_MESSAGE &&
          event.data &&
          event.data.source &&
          event.data.source.kind === "user",
      );
      if (target === undefined) return { ok: false, error: "Target user message not found" };

      const agents = this.ctx.get("agents");
      const sourceAgent = agents ? agents.get(sessionId) : undefined;
      if (sourceAgent && sourceAgent.status === "running") {
        try {
          await sourceAgent.cancel("edited");
        } catch (_) {}
      }

      const originalContent = Array.isArray(target.data && target.data.content) ? target.data.content : [];
      const nonTextBlocks = originalContent.filter((block) => block && block.type !== "text");
      const newContent = [
        ...nonTextBlocks,
        { type: "text", text },
      ];

      // Determine cut boundary:
      // Track turns, completed steps, and user messages to differentiate
      // an initial turn prompt from an in-flight steering message.
      let currentTurn = null;
      let currentTurnStartSeq = null;
      let turnUserMessages = [];
      let lastCompletedTurnEndSeq = null;
      let lastStepEndSeqInTurn = null;

      for (const event of events) {
        if (event.seq > targetSeq) break;

        if (event.type === "turn/start") {
          currentTurn = event.data?.turn;
          currentTurnStartSeq = event.seq;
          turnUserMessages = [];
          lastStepEndSeqInTurn = null;
        } else if (event.type === "turn/end") {
          lastCompletedTurnEndSeq = event.seq;
          currentTurn = null;
          currentTurnStartSeq = null;
          turnUserMessages = [];
          lastStepEndSeqInTurn = null;
        } else if (event.type === "step/end") {
          if (event.seq < targetSeq) {
            lastStepEndSeqInTurn = event.seq;
          }
        } else if (event.type === USER_MESSAGE && event.data?.source?.kind === "user") {
          turnUserMessages.push(event.seq);
        }
      }

      // If target message is the first user message in its turn, we are editing
      // the initial prompt and rewind to before this turn opened.
      // If it is a subsequent user message in the same turn (steering message),
      // we preserve all completed steps in this turn prior to this steering message.
      const isInitialTurnPrompt = turnUserMessages.length <= 1 || turnUserMessages[0] === targetSeq;

      let boundary = null;
      if (isInitialTurnPrompt) {
        boundary = lastCompletedTurnEndSeq;
      } else {
        boundary = lastStepEndSeqInTurn !== null ? lastStepEndSeqInTurn : lastCompletedTurnEndSeq;
      }

      const workspaceRegistry = this.ctx.get("workspaceRegistry");
      const workspace = workspaceRegistry
        ? workspaceRegistry.list().find((w) => w.sessionIds && w.sessionIds.includes(sessionId))
        : undefined;

      const titles = this.ctx.get("sessionTitle");
      let sourceTitle = undefined;
      if (titles && sourceAgent) {
        try {
          sourceTitle = titles.titleOf(sourceAgent.session);
        } catch (_) {}
      }
      if (!sourceTitle && observed.header && observed.header.title) {
        sourceTitle = observed.header.title;
      }

      const sessionController = this.ctx.get("sessionController");
      if (sessionController === undefined) {
        return { ok: false, error: "Session controller unavailable" };
      }

      const isFork = boundary !== null;
      const { seed: cleanSeed, inheritedEventCount } = await buildPlatformSeed(events, boundary);

      const childId = `session-${crypto.randomUUID()}`;
      const composition = await sessionController.agents.composeAgent(
        sessionController.agents.presetForObservation(observed),
      );

      const agentDefaultModel = this.ctx.get("agentDefaultModel");
      const selection = agentDefaultModel
        ? agentDefaultModel.currentSelection()
        : { provider: "openai", model: "gpt-5.6-luna" };

      await agents.create({
        sessionId: childId,
        ...(isFork ? { seed: cleanSeed, inheritedEventCount } : {}),
        meta: {
          ...(observed.header && observed.header.cwd === undefined ? {} : { cwd: observed.header.cwd }),
          parentSession: observed.header ? observed.header.id : sessionId,
          isSeeded: isFork,
          ...(composition.agentPreset === undefined ? {} : { agentPreset: composition.agentPreset }),
        },
        agentOptions: {
          provider: selection.provider,
          model: selection.model,
        },
        setup: composition.setup,
      });

      if (workspace) {
        try {
          await workspace.attachSession(childId);
        } catch (_) {}
      }

      const childAgent = agents ? agents.get(childId) : undefined;
      if (childAgent) {
        const message = {
          id: `msg-${crypto.randomUUID()}`,
          role: "user",
          content: newContent,
          source: {
            kind: "user",
            ...(target.data && target.data.source && target.data.source.clientTimeZone
              ? { clientTimeZone: target.data.source.clientTimeZone }
              : {}),
          },
        };
        childAgent.followup(message);
      }

      if (titles && childAgent && sourceTitle) {
        try {
          titles.rename(childAgent.session, sourceTitle);
        } catch (_) {}
      }

      // fallback archive in case client disconnects before calling detach
      this.scheduleArchive(sessionId);

      return {
        ok: true,
        mode: isFork ? "fork" : "fresh",
        childId,
        oldSessionId: sessionId,
      };
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    } finally {
      if (observed && typeof observed[Symbol.dispose] === "function") {
        try {
          observed[Symbol.dispose]();
        } catch (_) {}
      }
    }
  }

  scheduleArchive(sessionId) {
    if (this.pendingArchives.has(sessionId)) {
      clearTimeout(this.pendingArchives.get(sessionId));
    }
    this.pendingArchives.set(
      sessionId,
      setTimeout(() => {
        this.pendingArchives.delete(sessionId);
        this.archive(sessionId).catch(() => {});
      }, 15000),
    );
  }

  async detach(sessionId) {
    return this.archive(sessionId);
  }

  async archive(sessionId) {
    try {
      if (typeof sessionId !== "string" || sessionId === "") return { ok: false, error: "Invalid sessionId" };

      if (this.pendingArchives.has(sessionId)) {
        clearTimeout(this.pendingArchives.get(sessionId));
        this.pendingArchives.delete(sessionId);
      }

      const agents = this.ctx.get("agents");
      const agent = agents ? agents.get(sessionId) : undefined;
      if (agent && agent.status === "running") {
        try {
          await agent.cancel("edited");
        } catch (_) {}
      }

      const workspaceRegistry = this.ctx.get("workspaceRegistry");
      if (workspaceRegistry) {
        try {
          await workspaceRegistry.archiveSession(sessionId);
        } catch (err) {
          // fallback: detach manually from workspaces if archiveSession fails
          for (const w of workspaceRegistry.list()) {
            if (w.sessionIds && w.sessionIds.includes(sessionId)) {
              await w.detachSession(sessionId).catch(() => {});
            }
          }
        }
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    }
  }
}
