#!/usr/bin/env node
import { Command } from 'commander';
import { ZoofficeServer } from './server/server.js';
import { Bridge } from './client/bridge.js';

const program = new Command();

program
  .name('zooffice')
  .description('Zooffice — Agent Orchestration Framework')
  .version('0.1.0');

// ── Server ──
const serverCmd = program.command('server').description('Server commands');

serverCmd
  .command('start')
  .description('Start the Zooffice server')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('--host <string>', 'Host to bind', '0.0.0.0')
  .option('--render', 'Also start the tmux renderer', false)
  .option('--logs-dir <path>', 'Directory for log files', 'logs')
  .option('--docker', 'Spawn hired agents as Docker containers', false)
  .option('--docker-image <name>', 'Docker image for agent containers', 'ghcr.io/marcpilgaard/zooffice-client:latest')
  .option('--docker-network <name>', 'Docker network for agent containers', 'host')
  .option('--docker-env <KEY=VAL...>', 'Extra env vars for agent containers (repeatable)', (val: string, acc: string[]) => { acc.push(val); return acc; }, [] as string[])
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);

    let spawner: import('./server/spawner.js').AgentSpawner | undefined;
    if (opts.docker) {
      const { DockerSpawner } = await import('./server/spawner.js');
      const extraEnv: Record<string, string> = {};
      for (const pair of opts.dockerEnv as string[]) {
        const eq = pair.indexOf('=');
        if (eq > 0) extraEnv[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
      spawner = new DockerSpawner({ image: opts.dockerImage, network: opts.dockerNetwork, env: extraEnv });
    }

    const serverUrl = `ws://${opts.host}:${port}`;
    const server = new ZoofficeServer({ logsDir: opts.logsDir, spawner, serverUrl });
    await server.start({ port, host: opts.host });
    console.log(`Zooffice server running on ${serverUrl}`);
    console.log(`Logging to ${server.getLogFilePath()}`);

    let tmux: import('./renderer/tmux-manager.js').TmuxManager | null = null;

    if (opts.render) {
      const { TmuxManager } = await import('./renderer/tmux-manager.js');
      const { formatRoomEvent, formatOfficeEvent, formatStateSnapshot, getRoomMembers } = await import('./renderer/room-panel.js');
      const { default: WebSocket } = await import('ws');
      const { parseMessage } = await import('./shared/protocol.js');

      tmux = new TmuxManager();
      const ws = new WebSocket(`ws://localhost:${port}/render`);

      ws.on('open', () => {
        tmux!.init();
        tmux!.sendToOfficePane('Zooffice renderer connected. Waiting for agents...');
        tmux!.attach();
      });

      ws.on('message', (data: { toString(): string }) => {
        const msg = parseMessage(data.toString());
        if (!msg) return;
        if (msg.type === 'room_event') {
          const evt = msg as import('./shared/protocol.js').RoomEvent;
          tmux!.ensurePane(evt.room);
          tmux!.sendToPane(evt.room, formatRoomEvent(evt));
        } else if (msg.type === 'office_event') {
          tmux!.sendToEventPane(formatOfficeEvent(msg as import('./shared/protocol.js').OfficeEvent));
        } else if (msg.type === 'state_snapshot') {
          const snap = msg as import('./shared/protocol.js').StateSnapshot;
          const lines = formatStateSnapshot(snap);
          tmux!.clearOfficePane();
          for (const line of lines) {
            tmux!.sendToOfficePane(line);
          }
          for (const [room, members] of getRoomMembers(snap)) {
            tmux!.updatePaneTitle(room, `${room} [${members.join(', ')}]`);
          }
        }
      });
    }

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      tmux?.destroy();
      await server.stop();
      process.exit(0);
    });
  });

// ── Client ──
const clientCmd = program.command('client').description('Client commands');

clientCmd
  .command('connect')
  .description('Connect to a Zooffice server as an agent')
  .option('-s, --server <url>', 'Server WebSocket URL', 'ws://localhost:3000')
  .requiredOption('-n, --name <string>', 'Agent name')
  .requiredOption('-t, --title <string>', 'Agent title')
  .option('-r, --role <string>', 'Agent role', 'worker')
  .requiredOption('-g, --goal <string>', 'Agent goal')
  .action(async (opts) => {
    const bridge = new Bridge({
      serverUrl: opts.server,
      name: opts.name,
      title: opts.title,
      role: opts.role,
      goal: opts.goal,
    });
    await bridge.connect();
    console.log(`Connected to ${opts.server} as ${opts.name}`);
    process.on('SIGINT', () => { bridge.disconnect(); process.exit(0); });
  });

// ── Renderer ──
program
  .command('render')
  .description('Start the tmux renderer')
  .option('-s, --server <url>', 'Server WebSocket URL', 'ws://localhost:3000/render')
  .action(async (_opts) => {
    // Dynamic import to avoid loading tmux deps unless needed
    const { TmuxManager } = await import('./renderer/tmux-manager.js');
    const { formatRoomEvent, formatOfficeEvent, formatStateSnapshot } = await import('./renderer/room-panel.js');
    const { default: WebSocket } = await import('ws');
    const { parseMessage } = await import('./shared/protocol.js');

    const tmux = new TmuxManager();
    let connected = false;

    const ws = new WebSocket(_opts.server);
    ws.on('error', () => {
      if (!connected) { console.error(`Could not connect to ${_opts.server}`); process.exit(1); }
      tmux.sendToOfficePane('');
      tmux.sendToOfficePane('\x1b[31m══ CONNECTION ERROR ══\x1b[0m');
      tmux.sendToOfficePane('\x1b[2mPress q to quit, or Ctrl+B then D to detach.\x1b[0m');
    });
    ws.on('open', () => {
      connected = true;
      tmux.init();
      tmux.sendToOfficePane('Zooffice renderer connected. Waiting for agents...');
      tmux.attach();
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on('data', (data: Buffer) => {
        if (data.toString() === 'q') { ws.close(); tmux.destroy(); process.exit(0); }
      });
    });
    ws.on('message', (data: { toString(): string }) => {
      const msg = parseMessage(data.toString());
      if (!msg) return;
      if (msg.type === 'room_event') {
        const evt = msg as import('./shared/protocol.js').RoomEvent;
        tmux.ensurePane(evt.room);
        tmux.sendToPane(evt.room, formatRoomEvent(evt));
      } else if (msg.type === 'office_event') {
        tmux.sendToOfficePane(formatOfficeEvent(msg as import('./shared/protocol.js').OfficeEvent));
      } else if (msg.type === 'state_snapshot') {
        const lines = formatStateSnapshot(msg as import('./shared/protocol.js').StateSnapshot);
        tmux.clearOfficePane();
        for (const line of lines) {
          tmux.sendToOfficePane(line);
        }
      }
    });
    ws.on('close', () => {
      if (!connected) return;
      tmux.sendToOfficePane('');
      tmux.sendToOfficePane('\x1b[31m══ DISCONNECTED ══\x1b[0m');
      tmux.sendToOfficePane('\x1b[31mServer connection lost.\x1b[0m');
      tmux.sendToOfficePane('\x1b[2mPress q to quit, or Ctrl+B then D to detach.\x1b[0m');
    });
    process.on('SIGINT', () => { ws.close(); tmux.destroy(); process.exit(0); });
  });

program.parse(process.argv);
