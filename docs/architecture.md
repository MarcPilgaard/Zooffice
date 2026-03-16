# Zooffice Architecture

Zooffice is an agent orchestration framework themed as an "office of animals." Autonomous AI agents connect to a central server, communicate through rooms, spend **kibble** to use tools, and can hire sub-agents — all coordinated over WebSocket.

---

## Three-Layer Architecture

```mermaid
graph TB
    subgraph Renderer["Renderer Layer"]
        TM[TmuxManager]
        RP[RoomPanel]
    end

    subgraph Server["Server Layer"]
        WS[WebSocket Server]
        OF[Office]
        AR[AgentRegistry]
        RM[RoomManager]
        KL[KibbleLedger]
        TR[ToolRegistry]
        PH[ProtocolHandler]
        SP[DockerSpawner]
    end

    subgraph Client["Client Layer"]
        BR[Bridge]
        CW[ClaudeWrapper]
    end

    BR -->|WebSocket| WS
    CW -->|stdin/stdout| BR
    WS --> PH
    PH --> OF
    OF --> AR
    OF --> RM
    OF --> KL
    OF --> TR
    OF --> SP
    WS -->|/render endpoint| TM
    TM --> RP
```

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| **Server** | Central orchestrator — manages agents, rooms, kibble, tools, and the WebSocket protocol | `src/server/office.ts`, `src/server/server.ts`, `src/server/protocol/handler.ts` |
| **Client** | Bridge between the server and a Claude CLI instance — translates WebSocket messages into prompts and tool calls back into protocol messages | `src/client/bridge.ts`, `src/client/claude-wrapper.ts` |
| **Renderer** | Tmux-based observer UI — subscribes to server broadcasts and displays one pane per room plus an office status pane | `src/renderer/tmux-manager.ts`, `src/renderer/room-panel.ts` |

---

## WebSocket Protocol Flow

Three message families flow over the wire, defined in `src/shared/protocol.ts`:

| Direction | Types | Purpose |
|-----------|-------|---------|
| Client → Server | `register`, `tool_invoke`, `talk` | Agent registration, tool execution requests, direct messages |
| Server → Client | `registered`, `message`, `tool_result`, `state_update`, `error` | Registration confirmation, incoming messages, tool results |
| Server → Renderer | `room_event`, `office_event`, `state_snapshot` | Broadcast events for the observer UI |

```mermaid
sequenceDiagram
    participant C as Client (Bridge)
    participant S as Server
    participant R as Renderer

    C->>S: register {name, title, role, goal}
    S->>C: registered {agentId, kibble, availableTools, office}
    S->>R: state_snapshot (broadcast)

    Note over C: Agent is now active

    C->>S: tool_invoke {tool: "room-enter", args: {room: "war-room"}}
    S->>C: tool_result {success: true, kibbleRemaining: 100}
    S->>R: room_event {room: "war-room", event: "join"}
    S->>R: state_snapshot (broadcast)

    C->>S: tool_invoke {tool: "talk", args: {to: "war-room", message: "Hello!"}}
    S->>C: tool_result {success: true, kibbleRemaining: 99}
    S-->>C: message {from: "OtherAgent", room: "war-room", text: "Hi back!"}
    S->>R: room_event {room: "war-room", event: "message"}

    C->>S: tool_invoke {tool: "hire", args: {name: "Dev", title: "Developer", ...}}
    S->>C: tool_result {success: true, kibbleRemaining: 79}
    S->>R: office_event {event: "agent_spawned"}
    S->>R: state_snapshot (broadcast)
```

---

## Agent Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Connecting: Client opens WebSocket
    Connecting --> Registering: send register message
    Registering --> Active: server responds with registered
    Active --> Active: tool_invoke / message / talk
    Active --> Hiring: tool_invoke hire
    Hiring --> Active: tool_result (spawner creates child)
    Active --> Disconnected: WebSocket close
    Disconnected --> [*]: agent removed from registries

    state Active {
        [*] --> Idle
        Idle --> Processing: incoming message / tool_result
        Processing --> WaitingForTools: pending tool calls
        WaitingForTools --> Processing: all tool_results received
        Processing --> Idle: response sent
    }
```

### Registration Details

1. **Client connects** via WebSocket to the server.
2. **Client sends** a `register` message with `{name, title, role, goal}`.
3. **Server creates** an `Agent` in the `AgentRegistry`, credits initial kibble (100) via the `KibbleLedger`, and responds with a `registered` message containing the agent ID, kibble balance, available tools, and office overview.
4. **Bridge rebuilds** its system prompt with the tool definitions received from the server.

### Hiring Sub-Agents

1. Parent agent invokes the `hire` tool with `{name, title, role, goal}`.
2. Server registers a *disconnected* agent placeholder and auto-joins it into the parent's current room.
3. If **server-managed spawning** is enabled (Docker mode), the `DockerSpawner` launches a container. Otherwise, the client-side Bridge spawns a child `zooffice client connect` process.
4. The new agent connects and the server matches it to the pre-registered placeholder via name.

---

## Kibble Economy

Every agent starts with **100 kibble**. Each tool invocation costs a fixed amount, debited before execution.

| Tool | Cost | Description |
|------|------|-------------|
| `talk` | 1 kibble | Send a message to a room or agent |
| `room-enter` | 0 kibble | Enter a room (creates it if needed) |
| `room-leave` | 0 kibble | Leave a room |
| `bash` | 5 kibble | Run a shell command (30s timeout) |
| `hire` | 20 kibble | Hire a new agent |
| `transfer-kibble` | 0 kibble | Transfer kibble to another agent |

```mermaid
graph LR
    A[Agent A<br/>100 kibble] -->|hire -20| B[Agent B<br/>100 kibble]
    A -->|transfer-kibble 30| B
    A -->|talk -1| Room[Room]
    A -->|bash -5| Shell[Shell]
```

- **Debit**: The `KibbleLedger` checks the balance before each tool call. If insufficient, the tool call fails.
- **Credit**: New agents receive 100 kibble on registration. Agents can transfer kibble freely with `transfer-kibble`.
- **Ledger**: All transactions are recorded with timestamps and reasons for auditability.

---

## Room System & Message Routing

```mermaid
graph TD
    subgraph Rooms
        R1[war-room]
        R2[dev-room]
    end

    A1[Rex - CEO] -->|member of| R1
    A2[Dev - Developer] -->|member of| R1
    A2 -->|member of| R2
    A3[QA - Tester] -->|member of| R2

    A1 -.->|talk to war-room| R1
    R1 -.->|delivers to all members<br/>except sender| A2
```

### How Rooms Work

- **Enter**: An agent calls `room-enter`. The server creates the room if it doesn't exist, adds the agent as a member, and broadcasts a `join` event.
- **Leave**: An agent calls `room-leave`. The server removes them and broadcasts a `leave` event.
- **Talk**: An agent calls `talk` with a room name. The message is delivered to all room members *except* the sender. A `room_event` broadcast is sent to renderers.
- **Direct Messages**: `talk` can also target an agent name directly (not a room). The message is delivered privately via the agent's WebSocket connection.
- **Auto-join on Hire**: When an agent hires a sub-agent, the new agent is automatically joined into the hiring agent's current room.

---

## Docker Spawner Flow

When the server runs with `--docker`, hired agents are spawned as Docker containers instead of local child processes.

```mermaid
sequenceDiagram
    participant P as Parent Agent
    participant S as Server (Office)
    participant DS as DockerSpawner
    participant D as Docker Container
    participant NA as New Agent

    P->>S: tool_invoke hire {name, title, role, goal}
    S->>S: Register placeholder agent (disconnected)
    S->>DS: spawn(config, serverUrl)
    DS->>DS: Generate container name
    DS->>DS: Collect env vars (API keys, tokens)

    opt GitHub App configured
        DS->>DS: Generate installation token
    end

    DS->>D: docker run --rm zooffice-client --server ws://... --name ...
    D->>S: WebSocket connect
    D->>S: register {name, title, role, goal}
    S->>S: Match to placeholder by name → reconnect
    S->>NA: registered {agentId, kibble, tools, office}
    S->>P: tool_result {success: true}
```

### Environment Variables

The `DockerSpawner` forwards these environment variables into each container:

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` | Claude CLI authentication |
| `GH_TOKEN` / `GITHUB_TOKEN` | GitHub CLI authentication |
| `ZOOFFICE_AGENT_NAME` | The agent's name (set per container) |

If a **GitHub App** is configured (`--github-app-id`, `--github-app-private-key`, `--github-app-installation-id`), a fresh installation token is generated per spawn and injected as `GH_TOKEN`.

---

## CLI Commands

```bash
# Start the server
zooffice server start --port 3000

# Start server with Docker spawning
zooffice server start --port 3000 --docker --docker-image ghcr.io/marcpilgaard/zooffice-client:latest

# Start server with integrated tmux renderer
zooffice server start --port 3000 --render

# Connect a client agent
zooffice client connect --server ws://localhost:3000 --name Rex --title CEO --goal "Manage the team"

# Start standalone tmux renderer
zooffice render --server ws://localhost:3000/render
```

---

## Project Structure

```
src/
├── cli.ts                      # Combined CLI entry point (server/client/render)
├── shared/
│   └── protocol.ts             # All WebSocket message type definitions
├── server/
│   ├── office.ts               # Top-level wiring (registers tools, manages connections)
│   ├── server.ts               # WebSocket server (ZoofficeServer)
│   ├── spawner.ts              # DockerSpawner for container-based agent launching
│   ├── github-app.ts           # GitHub App authentication for agent tokens
│   ├── logger.ts               # JSON-line logger
│   ├── agent/                  # Agent model and registry
│   ├── room/                   # Room model and manager
│   ├── kibble/                 # Kibble ledger (balance tracking)
│   ├── tools/                  # Built-in tool definitions
│   └── protocol/               # Protocol message handler
├── client/
│   ├── bridge.ts               # WebSocket ↔ Claude CLI bridge
│   └── claude-wrapper.ts       # Spawns `claude` CLI, parses tool calls
└── renderer/
    ├── tmux-manager.ts         # Tmux session/pane management
    └── room-panel.ts           # Event formatting for panes
```
