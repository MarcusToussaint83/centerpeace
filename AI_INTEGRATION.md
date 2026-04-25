# AI Integration Guide

Centerpeace offers three modes for AI-assisted seating. Pick whichever
fits your nonprofit's existing setup.

## Quick comparison

| Mode    | Cost              | Setup       | Privacy            | Best for                       |
|---------|-------------------|-------------|--------------------|--------------------------------|
| Solver  | Free              | None        | All on your server | Always available, baseline     |
| API     | Per-token usage   | API key     | Sent to provider   | Orgs with API budget           |
| Agent   | Existing Claude/etc| Folder path | All local          | Orgs with AI subscriptions     |

You can mix modes — set a default at the org level, override per event.

## Solver mode (default)

Solver mode uses a deterministic constraint solver. It handles every hard
rule in your event:

- must_sit_with constraints
- must_not_sit_with constraints
- locked seats
- table capacity
- accessibility requirements

It returns either a valid arrangement or a clear explanation of which
constraints are unsatisfiable.

**No setup needed.** Solver mode is the default. Click "Suggest
arrangement" and it runs.

**Limitations**: solver mode handles hard rules but not soft strategic
goals (cultivation strategy, conversation dynamics, donor stage
considerations). For those, use API or agent mode on top of the solver.

## API mode

API mode adds LLM-powered soft optimization on top of the solver. The
solver finds a valid baseline; the LLM refines for strategic goals and
provides natural-language explanations.

### Supported providers

- **Anthropic** — Claude (recommended)
- **OpenAI** — GPT-4 family
- **Google** — Gemini family
- **Ollama** — for self-hosted local models

### Configuration

In your `.env` file:

```
AI_MODE=api
AI_PROVIDER=anthropic
AI_MODEL=claude-opus-4-7
ANTHROPIC_API_KEY=sk-ant-...
```

Or, for OpenAI:

```
AI_MODE=api
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo
OPENAI_API_KEY=sk-...
```

Or, for a local Ollama setup:

```
AI_MODE=api
AI_PROVIDER=ollama
AI_MODEL=llama3.1:70b
OLLAMA_BASE_URL=http://localhost:11434
```

Restart the app. AI mode is now active for all events in this
deployment unless overridden per-event in event settings.

### What you get

- "Suggest arrangement" produces a strategic seating with per-guest
  reasoning
- "Explain this seating" generates a natural-language summary of why a
  table works
- Constraint violation explanations include suggestions for fixes

### Cost expectations

A typical 500-guest event suggestion uses approximately 30,000-50,000
tokens. At Claude Opus pricing, that's roughly $0.50-$1.00 per
suggestion. Most events run 5-15 suggestions during planning, so total
cost per event is typically under $20.

## Agent mode

Agent mode is for nonprofits that already have an AI subscription
(Claude Pro for Cowork, Claude Code subscription, ChatGPT Plus with
desktop access, Cursor, etc.) and want to use it instead of paying for
API usage on top.

The flow:

1. Centerpeace writes structured files to a workspace folder on your
   computer.
2. You point your AI agent at that folder.
3. When you want AI help, click "Generate AI request" — Centerpeace
   writes a request file.
4. You ask your AI agent to "process the latest request in this folder."
5. Your agent reads the request, the current state, and the workspace
   instructions, then writes a response file.
6. Centerpeace detects the response, validates it, and surfaces the
   proposal in the canvas.

### Setup

1. In Centerpeace, go to event settings, set AI mode to "agent".
2. Set the workspace path. Default is
   `~/seating-charts/<your-org>/<event-name>/`.
3. Centerpeace creates the folder with all needed files.
4. Open the folder in your AI agent (instructions per agent below).

### Using with Claude Cowork

Claude Cowork can browse and edit local folders.

1. Open Claude Cowork.
2. Add the workspace folder as a project.
3. Tell Cowork: "This is a seating chart workspace for Centerpeace.
   Read the README.md to understand the format. When I ask you to
   process a request, read the latest file in `requests/`, the
   `current-state.json`, and write a response to `responses/` matching
   the schema."
4. In Centerpeace, click "Generate AI request" → "Suggest arrangement".
5. In Cowork: "Process the latest request."
6. When Cowork finishes, switch back to Centerpeace — the proposal
   appears.

### Using with Claude Code

Claude Code is excellent for this workflow because it's agentic by
default.

1. Open a terminal in the workspace folder.
2. Run `claude` to start Claude Code.
3. Tell Claude Code: "Read the README.md in this folder. When I ask you
   to process a request, follow the instructions there."
4. In Centerpeace, click "Generate AI request".
5. In Claude Code: "Process the latest request in `requests/`."
6. The proposal appears in Centerpeace when Claude Code finishes.

### Using with Cursor or other agents

Any agentic tool that can read and write files in a folder works.
Point it at the workspace, ask it to read the README, and follow the
same process.

### Privacy in agent mode

In agent mode, all guest data stays on your computer. Centerpeace writes
files to your local filesystem; your AI agent reads them locally. The
data only leaves your machine if you've configured your agent to use a
cloud LLM (which most do — Claude Cowork sends queries to Anthropic, for
instance). The difference is that you control what's sent and when.

If you need fully-local AI, combine agent mode with a local Ollama
instance via your agent of choice, or use API mode with Ollama directly.

### When agent mode shines

- Your nonprofit already has Claude Pro or similar subscriptions
- You want to avoid setting up and managing API keys
- You want full visibility into what the AI is being asked
- You want to iterate on the AI's instructions (the workspace README)
  to match your org's seating philosophy

### When API mode is better

- You want fully automated suggestions without context-switching to
  another tool
- You're running Centerpeace as a hosted service for multiple staff
- You don't already have an AI subscription

## Switching modes

You can switch modes per event without losing data. Event settings →
AI mode → pick. Existing comments, versions, and seating are preserved.

## Customizing the agent's instructions

The workspace `README.md` is the system prompt your AI agent uses. It
ships with sensible defaults, but you can edit it to teach your AI:

- Your org's specific cultivation philosophy
- Custom guest attributes you've added (donor stage labels, etc.)
- Tone and style preferences for explanations
- Things to always or never do

Edits to the workspace README persist; Centerpeace doesn't overwrite it.
This makes the workspace README a powerful customization point — and one
we hope nonprofits will share with each other.

## Troubleshooting

**"Agent response failed schema validation"** — Your agent wrote a
response that doesn't match the expected JSON schema. Check the error
detail, look at `schemas/examples/` for the correct format, and ask your
agent to retry.

**"No response detected"** — The file watcher may not have noticed the
new file (rare on macOS/Linux, occasional on Windows). Click "Refresh"
in the suggestions panel to re-scan the folder.

**"Agent proposed moves that violate hard constraints"** — Centerpeace
flags these in red. You can accept anyway (your call), reject, or ask
your agent to revise with the constraint reminder.

**"AI suggestions are slow"** — In agent mode, latency depends on your
agent. Cowork and Claude Code typically take 30-90 seconds for a
500-guest event. API mode is usually faster (10-30s for the same).
