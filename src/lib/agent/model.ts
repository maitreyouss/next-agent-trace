import { AIMessage, type BaseMessage, ToolMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { readCard, type LedgerCard } from "@/data/catalog";
import { FALLBACK, formatAnswer, REFUSAL } from "@/lib/agent/copy";
import { createModelTools, OPEN_TOOL, SEARCH_TOOL } from "@/lib/agent/tools";

export type AgentModel = {
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
};

export type ScriptStep =
  | { kind: "tool"; name: string; args: Record<string, unknown> }
  | { kind: "text"; text: string };

function toolCall(name: string, args: Record<string, unknown>, id: string) {
  return new AIMessage({
    content: "",
    tool_calls: [{ id, name, args, type: "tool_call" }],
  });
}

function messageText(message: BaseMessage): string {
  const { content } = message;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return String(part.text ?? "");
      }
      return "";
    })
    .join("");
}

export function createScriptedModel(steps: ScriptStep[]): AgentModel {
  let index = 0;
  return {
    async invoke() {
      const step = steps[Math.min(index, Math.max(steps.length - 1, 0))];
      index += 1;
      if (!step) return new AIMessage(REFUSAL);
      if (step.kind === "tool") {
        return toolCall(step.name, step.args, `call_${index}`);
      }
      return new AIMessage(step.text);
    },
  };
}

export function createLocalModel(): AgentModel {
  return {
    async invoke(messages) {
      const toolMessages = messages.filter(
        (message): message is ToolMessage => message.getType() === "tool",
      );
      if (toolMessages.length === 0) {
        const human = [...messages]
          .reverse()
          .find((message) => message.getType() === "human");
        return toolCall(
          SEARCH_TOOL,
          { query: human ? messageText(human) : "" },
          "call_search",
        );
      }

      const last = toolMessages[toolMessages.length - 1];
      let parsed: { hits?: { id: string }[]; found?: boolean; card?: LedgerCard };
      try {
        parsed = JSON.parse(String(last.content)) as typeof parsed;
      } catch {
        return new AIMessage(FALLBACK);
      }

      if (last.name === SEARCH_TOOL) {
        const id = parsed.hits?.[0]?.id;
        if (!id) return new AIMessage(REFUSAL);
        return toolCall(OPEN_TOOL, { id }, "call_open");
      }

      if (last.name === OPEN_TOOL && parsed.found && parsed.card) {
        const card = readCard(parsed.card.id) ?? parsed.card;
        return new AIMessage(formatAnswer(card));
      }

      return new AIMessage(REFUSAL);
    },
  };
}

export function createLiveModel(): AgentModel {
  const llm = new ChatOpenAI({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    timeout: 8000,
    maxRetries: 1,
  }).bindTools(createModelTools());

  return {
    async invoke(messages) {
      const message = await llm.invoke(messages);
      if (AIMessage.isInstance(message)) return message;
      return new AIMessage({ content: messageText(message) });
    },
  };
}
