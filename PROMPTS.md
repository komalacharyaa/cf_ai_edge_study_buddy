# PROMPTS

**Tool:** ChatGPT (web)

**Purpose:** High-level guidance on structuring a Cloudflare Agents project and polishing documentation.

### Prompt – Project setup & structure (paraphrased)

> I need to build a small AI-powered application on Cloudflare for an assignment.  
> Requirements:  
> - Use an LLM (ideally Llama 3.3 on Workers AI or Agents)  
> - Have a clear workflow/coordination layer (Agents / Workers / Durable Objects)  
> - Provide user input via chat  
> - Maintain some memory or state  
> The repo must be prefixed with `cf_ai_`, include a README with run instructions, and a PROMPTS.md file.  
> Help me design a simple end-to-end project that satisfies these requirements.

**How I used it:**

- Used the response to sanity-check the overall architecture (Agent + chat UI + state).
- Took inspiration for naming and file layout.
- Implemented the actual code and wiring myself in the repo.

---

### Prompt 2 – README and PROMPTS wording (paraphrased)

> Give me a short, clear `README.md` for this Cloudflare AI app.  
> Mention that it uses Llama 3.3, has workflow/coordination, a chat UI, and memory/state.  
> Also include the assignment note about the repo name prefix and PROMPTS.md requirement.  
> Keep it concise and easy to follow.

**How I used it:**

- Used as a first draft for `README.md`.
- Edited, shortened, and adapted the text manually to match the final project.
