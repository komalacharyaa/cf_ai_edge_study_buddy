// src/index.ts

const SYSTEM_PROMPT = `
You are Edge Study Buddy, a friendly but concise study assistant.
- Keep answers focused and structured.
- When user asks to review or continue, use context from previous messages.
- If the user is studying security / systems / AI, tailor examples to that.
`;

export interface Env {
  AI: Ai;            // Workers AI binding
  CHAT_KV: KVNamespace; // Workers KV for memory
}

type Role = "system" | "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
}

interface ChatRequestBody {
  sessionId: string;
  message: string;
}

interface ChatResponseBody {
  reply: string;
  history: ChatMessage[];
}

const MAX_HISTORY_MESSAGES = 16; // keep context bounded (plus system prompt)

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight (useful if you ever call from a separate frontend origin)
    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(CHAT_HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

// ---------------------- API HANDLER ----------------------

async function handleChat(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Partial<ChatRequestBody>;

    if (!body.sessionId || typeof body.sessionId !== "string") {
      return json({ error: "Missing or invalid sessionId" }, 400);
    }
    if (!body.message || typeof body.message !== "string") {
      return json({ error: "Missing or invalid message" }, 400);
    }

    const sessionId = body.sessionId;
    const userMessage = body.message.trim();

    // 1) Load history from KV
    let history = await loadHistory(env, sessionId);

    if (history.length === 0) {
      history.push({
        role: "system",
        content: SYSTEM_PROMPT.trim(),
      });
    }

    // 2) Append new user message
    history.push({
      role: "user",
      content: userMessage,
    });

    // 3) Trim history to last N messages (keep system message at index 0)
    history = trimHistory(history, MAX_HISTORY_MESSAGES);

    // 4) Call Workers AI (Llama 3.3 70B) :contentReference[oaicite:4]{index=4}
    const aiResponse: any = await env.AI.run(
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      {
        messages: history,
        max_tokens: 512,
        temperature: 0.4,
      }
    );

    const replyText: string = aiResponse.response ?? "[no response]";

    // 5) Append assistant reply to history
    history.push({
      role: "assistant",
      content: replyText,
    });

    // 6) Persist updated history to KV
    await saveHistory(env, sessionId, history);

    const payload: ChatResponseBody = {
      reply: replyText,
      history,
    };

    return json(payload, 200);
  } catch (err: any) {
    console.error("Chat error", err);
    return json({ error: "Internal error" }, 500);
  }
}

// ---------------------- MEMORY HELPERS ----------------------

async function loadHistory(env: Env, sessionId: string): Promise<ChatMessage[]> {
  const raw = await env.CHAT_KV.get(sessionKey(sessionId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

async function saveHistory(
  env: Env,
  sessionId: string,
  history: ChatMessage[]
): Promise<void> {
  await env.CHAT_KV.put(sessionKey(sessionId), JSON.stringify(history), {
    expirationTtl: 60 * 60 * 24 * 7, // keep for 7 days
  });
}

function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

function trimHistory(history: ChatMessage[], maxMessages: number): ChatMessage[] {
  if (history.length <= maxMessages + 1) {
    // +1 to always keep system at index 0
    return history;
  }

  const systemMessage = history[0];
  const rest = history.slice(1);
  const trimmedRest = rest.slice(-maxMessages);
  return [systemMessage, ...trimmedRest];
}

// ---------------------- UTILS ----------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type",
      "access-control-allow-methods": "POST,OPTIONS",
    },
  });
}

function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type",
      "access-control-allow-methods": "POST,OPTIONS",
    },
  });
}

// ---------------------- FRONTEND HTML ----------------------

const CHAT_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Edge Study Buddy</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f172a;
      color: #e5e7eb;
      display: flex;
      justify-content: center;
      padding: 24px;
    }
    .app {
      width: 100%;
      max-width: 900px;
      background: #020617;
      border-radius: 16px;
      border: 1px solid #1e293b;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-height: 80vh;
    }
    header {
      padding: 16px 20px;
      border-bottom: 1px solid #1e293b;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    header h1 {
      margin: 0;
      font-size: 18px;
    }
    header p {
      margin: 0;
      font-size: 12px;
      color: #9ca3af;
    }
    .badge {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 4px 8px;
      border-radius: 999px;
      background: #022c22;
      color: #6ee7b7;
      border: 1px solid #047857;
      white-space: nowrap;
    }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }
    .bubble {
      max-width: 80%;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .bubble.user {
      margin-left: auto;
      background: #1d4ed8;
      color: #e5e7eb;
      border-bottom-right-radius: 2px;
    }
    .bubble.bot {
      margin-right: auto;
      background: #020617;
      border: 1px solid #1f2937;
      border-bottom-left-radius: 2px;
    }
    .bubble.system {
      margin: 0 auto;
      background: transparent;
      color: #9ca3af;
      font-size: 12px;
      border: none;
      text-align: center;
    }
    .role-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      margin-bottom: 2px;
    }
    form {
      padding: 12px 16px 16px;
      border-top: 1px solid #1e293b;
      display: flex;
      gap: 8px;
      background: #020617;
    }
    textarea {
      flex: 1;
      resize: none;
      border-radius: 12px;
      border: 1px solid #1f2937;
      padding: 10px 12px;
      background: #020617;
      color: #e5e7eb;
      font-family: inherit;
      font-size: 14px;
      min-height: 46px;
      max-height: 120px;
    }
    textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
    }
    button {
      border-radius: 999px;
      padding: 0 16px;
      border: none;
      background: #3b82f6;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    button[disabled] {
      opacity: 0.6;
      cursor: default;
    }
    .status {
      font-size: 11px;
      color: #6b7280;
      padding: 0 20px 8px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #6b7280;
    }
    .pill span.dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #22c55e;
    }
    .session-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 10px;
      color: #4b5563;
      margin-top: 2px;
      user-select: all;
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <div>
        <h1>Edge Study Buddy</h1>
        <p>LLM-powered study chat with memory on Cloudflare Workers AI.</p>
      </div>
      <div class="badge">Workers AI · KV Memory</div>
    </header>

    <div class="status">
      <span class="pill">
        <span class="dot"></span>
        <span>Connected · Session memory stored in KV</span>
      </span>
      <div class="session-id" id="session-id"></div>
    </div>

    <div class="messages" id="messages"></div>

    <form id="chat-form">
      <textarea
        id="user-input"
        placeholder="Ask a question about systems, security, ML, or anything you are studying..."
      ></textarea>
      <button type="submit" id="send-btn">
        Send
      </button>
    </form>
  </div>

  <script>
    const messagesEl = document.getElementById("messages");
    const formEl = document.getElementById("chat-form");
    const inputEl = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const sessionIdEl = document.getElementById("session-id");

    const SESSION_KEY = "cf_ai_edge_study_buddy_session";
    let sessionId = window.localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      if (crypto && crypto.randomUUID) {
        sessionId = crypto.randomUUID();
      } else {
        sessionId = "sess_" + Math.random().toString(36).slice(2);
      }
      window.localStorage.setItem(SESSION_KEY, sessionId);
    }
    sessionIdEl.textContent = "Session: " + sessionId;

    function appendMessage(role, text) {
      const wrapper = document.createElement("div");

      const label = document.createElement("div");
      label.className = "role-label";
      label.textContent =
        role === "user" ? "You" :
        role === "assistant" ? "Study Buddy" :
        "System";
      wrapper.appendChild(label);

      const bubble = document.createElement("div");
      bubble.className = "bubble " + role;
      bubble.textContent = text;
      wrapper.appendChild(bubble);

      messagesEl.appendChild(wrapper);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return bubble;
    }

    // Initial system message for context in UI
    appendMessage(
      "system",
      "Edge Study Buddy uses Llama 3.3 on Cloudflare Workers AI and stores your session in KV. Ask any question about what you’re studying."
    );

    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = inputEl.value.trim();
      if (!text) return;

      appendMessage("user", text);
      inputEl.value = "";
      inputEl.focus();

      sendBtn.disabled = true;
      const thinkingBubble = appendMessage("assistant", "Thinking...");

      try {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: text
          })
        });

        if (!resp.ok) {
          thinkingBubble.textContent = "Error: " + resp.status;
          return;
        }

        const data = await resp.json();
        thinkingBubble.textContent = data.reply || "[empty reply]";
      } catch (err) {
        console.error(err);
        thinkingBubble.textContent = "Network or server error.";
      } finally {
        sendBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
