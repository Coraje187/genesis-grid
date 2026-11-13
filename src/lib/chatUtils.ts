export interface ExportableMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface SlashCommandDef {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { command: "/clear", description: "Clear messages in the current chat" },
  { command: "/export", description: "Download conversation as Markdown (.md)" },
  { command: "/export json", description: "Download conversation as JSON (.json)" },
  { command: "/model ", description: "Switch active model (e.g. /model gemini)" },
  { command: "/compare", description: "Open Side-by-Side Model Compare" },
  { command: "/help", description: "List available slash commands" },
];

/** Rough token estimate (~4 chars per token for English/code). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Estimate total tokens across a chat message list. */
export function estimateSessionTokens(messages: ExportableMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
}

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export chat history as a formatted Markdown file. */
export function exportChatMarkdown(
  messages: ExportableMessage[],
  model: string,
  sessionId: string
) {
  const header = `# Genesis Grid Chat Export\n\n- **Session:** \`${sessionId}\`\n- **Model:** \`${model}\`\n- **Exported:** ${new Date().toISOString()}\n\n---\n\n`;
  const body = messages
    .map((m) => `### ${m.role.toUpperCase()}\n\n${m.content}\n`)
    .join("\n---\n\n");
  triggerDownload(`genesis-chat-${sessionId}.md`, header + body, "text/markdown;charset=utf-8");
}

/** Export chat history as a structured JSON file. */
export function exportChatJson(
  messages: ExportableMessage[],
  model: string,
  sessionId: string
) {
  const payload = {
    sessionId,
    model,
    exportedAt: new Date().toISOString(),
    messages,
  };
  triggerDownload(
    `genesis-chat-${sessionId}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8"
  );
}
