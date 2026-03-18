<div align="center">

```
 ______           __  __ _
|___  /          / _|/ _(_)
   / / ___   ___| |_| |_ _  ___ ___
  / / / _ \ / _ \  _|  _| |/ __/ _ \
 / /_| (_) | (_) | | | | | | (_|  __/
/_____\___/ \___/|_| |_| |_|\___\___|
```

### _Where animals run the show._ 🦁🐧🐱

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-blue)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

> An agent orchestration framework disguised as an office full of industrious animals.
> Autonomous AI agents clock in, chat in rooms, spend kibble, hire teammates, and get things done — all over WebSocket.

[Getting Started](#-getting-started) · [How It Works](#-how-it-works) · [Architecture](#-architecture) · [Docker](#-docker)

</div>

---

## 🏢 Meet the Team

```
🦖 Rex            CEO              "Ship it. Ship it all."
🐧 Penny          Technical Writer  Documents everything in sight.
🐱 Whiskers       Engineer          Just pushed to main without tests (again).
🦊 Foxworth       QA Lead           Finds bugs nobody else can see.
🐕 Barkley        Scrum Master      Keeps the standups under 15 minutes.
```

Welcome to **Zooffice** — where every agent has a name, a title, a role, and a mission. They communicate through rooms, spend **kibble** (the office currency) to use tools, and can even **hire sub-agents** to delegate work.

It is an office. It is a zoo. **It is both.**

---

## ✨ What is Zooffice?

Zooffice is a **multi-agent orchestration framework** built in TypeScript. It provides:

- 🖥️ A **central server** that manages agents, rooms, tools, and the kibble economy
- 🤖 A **client bridge** that connects each agent to Claude CLI, translating WebSocket messages into AI prompts
- 👀 A **tmux-based renderer** that lets you observe the entire office in real time — one pane per room

Agents are **fully autonomous**. They receive messages, decide what to do, and act — no human in the loop. They collaborate by talking in rooms, and they spend kibble to take actions. When a task is too big, they hire sub-agents and fund them with kibble transfers.

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 22
- npm
- tmux (for the renderer)
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) (for running agents)

### Installation

```bash
git clone https://github.com/MarcPilgaard/Zooffice.git
cd Zooffice
npm install
npm run build
```

### Quick Start

```bash
# Terminal 1 — Start the server
npm run start:server

# Terminal 2 — Spawn an agent
npm run start:client -- --name Rex --title CEO \
  --role "Chief Executive Officer" --goal "Run the office"

# Terminal 3 — Watch it all happen
npm run start:renderer
```

---

## 🔧 How It Works

### The Agent Lifecycle

```
  Spawn → Join Room → Work → Hire → Fund → Repeat
    │         │         │      │       │
    ▼         ▼         ▼      ▼       ▼
 Register  Enter a   Use     Create  Transfer
  with     room to   tools   sub-    kibble to
  name,    collab-   (talk,  agents  get them
  title,   orate     bash)          started
  role
```

1. **Spawn** — An agent is registered with a name, title, role, and goal
2. **Join a Room** — Agents enter rooms to communicate (one room at a time)
3. **Work** — Agents use tools to accomplish their goals: talk, run bash commands, enter/leave rooms
4. **Hire** — When work needs delegation, agents hire sub-agents into their current room
5. **Fund** — Sub-agents start with 0 kibble, so the hiring agent transfers kibble to get them going

### 💰 The Kibble Economy

Every action has a price. Kibble keeps agents focused and resource-aware.

| Tool | Cost | Description |
|:-----|:----:|:------------|
| `talk` | 🦴 1 | Send a message to a room or agent |
| `bash` | 🦴 5 | Run a shell command (30s timeout) |
| `hire` | 🦴 20 | Hire a new sub-agent |
| `room-enter` | Free | Enter a room (creates it if new) |
| `room-leave` | Free | Leave a room |
| `transfer-kibble` | Free | Transfer kibble to another agent |

No unlimited spending sprees — every action is a deliberate choice.

### 💬 Rooms

Rooms are where collaboration happens. Agents must enter a room to post messages in it. An agent can only be in **one room at a time**. Rooms are created on-the-fly when the first agent enters.

---

## 🏗️ Architecture

Zooffice has a **three-layer architecture**:

```
┌─────────────────────────────────────────────┐
│             🖥️  Renderer (tmux)              │
│        Observes rooms and office status      │
└──────────────────────┬──────────────────────┘
                       │ WebSocket
┌──────────────────────▼──────────────────────┐
│               🏢  Server                     │
│    Office: Agents, Rooms, Kibble, Tools      │
│    Protocol Handler: Message routing         │
└──────────────────────┬──────────────────────┘
                       │ WebSocket
┌──────────────────────▼──────────────────────┐
│               🤖  Client                     │
│    Bridge: WebSocket ↔ Claude CLI            │
│    Claude Wrapper: Manages AI sessions       │
└─────────────────────────────────────────────┘
```

| Layer | Path | Purpose |
|:------|:-----|:--------|
| **Server** | `src/server/` | Central orchestrator. Manages the office state — agent registry, room manager, kibble ledger, and tool registry. |
| **Client** | `src/client/` | Bridge between server and Claude CLI. Translates WebSocket messages into AI prompts and back. |
| **Renderer** | `src/renderer/` | tmux-based observer UI. Displays a live view of the office — one pane per room. |

---

## 🐳 Docker

Dockerfiles are provided for both server and client:

```bash
# Build
docker build -f Dockerfile.server -t zooffice-server .
docker build -f Dockerfile.client -t zooffice-client .

# Run
docker run -p 3000:3000 zooffice-server
docker run zooffice-client --name Rex --title CEO
```

---

## 🧪 Testing

```bash
npm test              # Run tests once
npm run test:watch    # Watch mode
```

---

## 🛠️ Tech Stack

| Technology | Purpose |
|:-----------|:--------|
| **TypeScript** | Type-safe agent orchestration |
| **Node.js >= 22** | Runtime |
| **WebSocket (ws)** | Real-time communication between all layers |
| **Claude CLI** | AI backbone for autonomous agents |
| **Commander** | CLI argument parsing |
| **tmux** | Renderer UI — terminal multiplexer for room panels |
| **Vitest** | Testing framework |
| **Docker** | Containerized deployment |

---

## 📄 License

MIT

---

<div align="center">

_No animals were harmed in the making of this office. Some were hired._ 🐾

**[⬆ Back to top](#)**

</div>
