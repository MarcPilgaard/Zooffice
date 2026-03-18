# 🏢 Zooffice

**An office of AI animal agents orchestrating work together.**

Zooffice is an agent orchestration framework where autonomous AI agents connect to a central server, communicate through rooms, and coordinate tasks — all powered by a kibble-based economy. Think of it as a virtual office where animal-themed AI agents collaborate, hire each other, and get things done.

## How it works

```
┌─────────────────────────────────────────────────┐
│                   Zooffice Server                │
│                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│   │  Rooms   │  │  Kibble  │  │    Tools     │  │
│   │  Manager │  │  Ledger  │  │   Registry   │  │
│   └──────────┘  └──────────┘  └──────────────┘  │
│                                                  │
│          WebSocket connections (ws://)            │
└──────┬──────────────┬───────────────┬────────────┘
       │              │               │
  ┌────┴────┐   ┌─────┴─────┐  ┌─────┴─────┐
  │ Rex     │   │ Dev       │  │ QA        │
  │ (CEO)   │   │ (Coder)   │  │ (Tester)  │
  └─────────┘   └───────────┘  └───────────┘
```

Agents connect via WebSocket, enter rooms to collaborate, and use **kibble** (the in-office currency) to perform actions like sending messages, running shell commands, and hiring new agents.

## Features

- **Autonomous agents** — Each agent is a Claude AI instance with a name, title, role, and goal
- **Room-based communication** — Agents enter rooms to collaborate, with messages delivered to all members
- **Kibble economy** — Every action has a cost, creating natural resource constraints
- **Agent hiring** — Agents can hire sub-agents on the fly to delegate work
- **Docker spawning** — Hired agents can be launched as isolated Docker containers
- **Tmux renderer** — Watch all rooms and agent activity in real-time via tmux panes
- **GitHub integration** — GitHub App auth support for agent containers

## Quick start

### Prerequisites

- Node.js >= 22
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) installed and authenticated
- Docker (optional, for container-based agent spawning)

### Install & run

```bash
# Clone the repo
git clone https://github.com/MarcPilgaard/Zooffice.git
cd Zooffice

# Install dependencies
npm install

# Build
npm run build

# Start the server
npx zooffice server start --port 3000

# In another terminal — connect an agent
npx zooffice client connect \
  --server ws://localhost:3000 \
  --name Rex --title CEO \
  --goal "Manage the team and ship features"
```

### With Docker spawning

```bash
# Start server in Docker mode — hired agents spawn as containers
npx zooffice server start --port 3000 \
  --docker \
  --docker-image ghcr.io/marcpilgaard/zooffice-client:latest
```

### With the tmux renderer

```bash
# Start server with live tmux UI
npx zooffice server start --port 3000 --render
```

## The kibble economy

Every agent starts with **100 kibble**. Actions cost kibble:

| Tool | Cost | What it does |
|------|------|-------------|
| `talk` | 1 | Send a message to a room or agent |
| `room-enter` | 0 | Enter (or create) a room |
| `room-leave` | 0 | Leave a room |
| `bash` | 5 | Run a shell command |
| `hire` | 20 | Hire a new sub-agent |
| `transfer-kibble` | 0 | Send kibble to another agent |

Agents can transfer kibble to each other, creating a collaborative resource-sharing dynamic.

## Architecture

Zooffice has three layers:

| Layer | Purpose |
|-------|---------|
| **Server** | Central orchestrator — manages agents, rooms, kibble, tools, and the WebSocket protocol |
| **Client** | Bridge between the server and a Claude CLI instance |
| **Renderer** | Tmux-based observer UI showing one pane per room |

See [docs/architecture.md](docs/architecture.md) for the full architecture documentation with Mermaid diagrams.

## Project structure

```
src/
├── cli.ts                 # CLI entry point (server/client/render)
├── shared/protocol.ts     # WebSocket message types
├── server/
│   ├── office.ts          # Top-level orchestrator
│   ├── server.ts          # WebSocket server
│   ├── spawner.ts         # Docker-based agent spawning
│   ├── agent/             # Agent model and registry
│   ├── room/              # Room model and manager
│   ├── kibble/            # Kibble ledger
│   ├── tools/             # Built-in tool definitions
│   └── protocol/          # Protocol message handler
├── client/
│   ├── bridge.ts          # WebSocket ↔ Claude CLI bridge
│   └── claude-wrapper.ts  # Claude CLI process manager
└── renderer/
    ├── tmux-manager.ts    # Tmux session management
    └── room-panel.ts      # Room event display
```

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Build
npm run build
```

## License

See [LICENSE](LICENSE) for details.
