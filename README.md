# cf_ai_agents_study_buddy

An AI-powered chat app built on **Cloudflare Agents** using **Workers AI (Llama 3.3)**.  
It demonstrates an end-to-end AI workflow running entirely at the edge.

## Features

- **LLM** – Uses Llama 3.3 on Workers AI for responses.
- **Workflow / Coordination** – Cloudflare Agent orchestrates tools + message routing.
- **User Input** – Chat-style UI in the browser (served by `index.html` / `src/app.tsx`).
- **Memory / State** – Per-session conversation history stored via the agent’s state.

## Getting Started

```bash
# Install dependencies
npm install

# Run locally
npm run dev
# Then open the URL printed in the terminal (e.g. http://127.0.0.1:8787/ or http://localhost:8787)
```

## Deploy

```bash
npm run deploy
# or
npx wrangler deploy
```

After deployment, use the Workers URL (e.g. https://<project>.<subdomain>.workers.dev) to try the app.

## Project Structure

- index.html – Root HTML file, mounts the chat UI.

- src/app.tsx – Frontend chat UI logic.

- src/server.ts – Cloudflare Agent + Workers AI + stateful logic.

- wrangler.json / wrangler.jsonc – Cloudflare config (bindings, compatibility).

- PROMPTS.md – AI prompts used while building this project (required by assignment).
