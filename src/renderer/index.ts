import { Command } from 'commander';
import WebSocket from 'ws';
import { parseMessage } from '../shared/protocol.js';
import type { RoomEvent, OfficeEvent, StateSnapshot, BroadcastMessage } from '../shared/protocol.js';
import { TmuxManager } from './tmux-manager.js';
import { formatRoomEvent, formatOfficeEvent, formatStateSnapshot, getRoomMembers } from './room-panel.js';

const program = new Command();

program
  .name('zooffice-renderer')
  .description('Zooffice tmux renderer');

program
  .command('start')
  .description('Start the renderer and connect to a Zooffice server')
  .option('-s, --server <url>', 'Server WebSocket URL', 'ws://localhost:3000/render')
  .action(async (opts) => {
    const tmux = new TmuxManager();
    let connected = false;

    const ws = new WebSocket(opts.server);

    ws.on('error', (err) => {
      if (!connected) {
        console.error(`Could not connect to ${opts.server}`);
        process.exit(1);
      }
      tmux.sendToOfficePane('');
      tmux.sendToOfficePane('\x1b[31m══ CONNECTION ERROR ══\x1b[0m');
      tmux.sendToOfficePane('\x1b[2mPress q to quit, or Ctrl+B then D to detach.\x1b[0m');
    });

    ws.on('open', () => {
      connected = true;
      tmux.init();
      tmux.sendToOfficePane('Zooffice renderer connected. Waiting for agents...');
      tmux.attach();

      // Listen for q to quit (only after tmux is up)
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdin.on('data', (data) => {
        if (data.toString() === 'q') {
          ws.close();
          tmux.destroy();
          process.exit(0);
        }
      });
    });

    ws.on('message', (data) => {
      const msg = parseMessage(data.toString()) as BroadcastMessage | null;
      if (!msg) return;

      if (msg.type === 'room_event') {
        const evt = msg as RoomEvent;
        tmux.ensurePane(evt.room);
        tmux.sendToPane(evt.room, formatRoomEvent(evt));
      } else if (msg.type === 'office_event') {
        tmux.sendToEventPane(formatOfficeEvent(msg as OfficeEvent));
      } else if (msg.type === 'state_snapshot') {
        const snap = msg as StateSnapshot;
        const lines = formatStateSnapshot(snap);
        tmux.clearOfficePane();
        for (const line of lines) {
          tmux.sendToOfficePane(line);
        }
        for (const [room, members] of getRoomMembers(snap)) {
          tmux.updatePaneTitle(room, `${room} [${members.join(', ')}]`);
        }
      }
    });

    ws.on('close', () => {
      if (!connected) return; // error handler will deal with it
      tmux.sendToOfficePane('');
      tmux.sendToOfficePane('\x1b[31m══ DISCONNECTED ══\x1b[0m');
      tmux.sendToOfficePane('\x1b[31mServer connection lost.\x1b[0m');
      tmux.sendToOfficePane('\x1b[2mPress q to quit, or Ctrl+B then D to detach.\x1b[0m');
    });

    process.on('SIGINT', () => {
      ws.close();
      tmux.destroy();
      process.exit(0);
    });
  });

program.parse(process.argv);
