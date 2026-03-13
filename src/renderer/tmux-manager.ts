import { execSync, spawn as nodeSpawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SESSION_NAME = 'zooffice';
const SCROLLBACK = 10000;

export class TmuxManager {
  private panes = new Map<string, string>(); // room -> pane id
  private paneLogPaths = new Map<string, string>(); // pane id -> log file path
  private officePaneId: string | null = null;
  private eventPaneId: string | null = null;
  private tmpDir: string | null = null;
  private exec: (cmd: string) => string;

  constructor(execFn?: (cmd: string) => string) {
    this.exec = execFn ?? ((cmd) => execSync(cmd, { encoding: 'utf-8' }));
  }

  init(): void {
    try {
      this.exec(`tmux has-session -t ${SESSION_NAME} 2>/dev/null`);
      this.exec(`tmux kill-session -t ${SESSION_NAME}`);
    } catch { /* no existing session */ }

    this.tmpDir = mkdtempSync(join(tmpdir(), 'zooffice-render-'));

    // Office status pane — direct tty writes (cleared + rewritten, no scrollback needed)
    this.officePaneId = this.exec(
      `tmux new-session -d -s ${SESSION_NAME} -n office -P -F '#{pane_id}' "cat"`
    ).trim();
    this.exec(`tmux set-option -t ${SESSION_NAME} -g history-limit ${SCROLLBACK}`);
    // Enable mouse scrolling
    this.exec(`tmux set-option -t ${SESSION_NAME} -g mouse on`);
    // Enable pane border titles
    this.exec(`tmux set-option -t ${SESSION_NAME} pane-border-status top`);
    this.exec(`tmux set-option -t ${SESSION_NAME} pane-border-format " #{pane_title} "`);
    this.exec(`tmux select-pane -t '${this.officePaneId}' -T 'Office'`);

    // Event log pane — tail -f for scrollable history
    const eventLog = join(this.tmpDir, 'events.log');
    writeFileSync(eventLog, '');
    this.eventPaneId = this.exec(
      `tmux split-window -t ${SESSION_NAME} -v -P -F '#{pane_id}' "tail -f '${eventLog}'"`
    ).trim();
    this.paneLogPaths.set(this.eventPaneId, eventLog);
    this.exec(`tmux select-pane -t '${this.eventPaneId}' -T 'Events'`);
    this.exec(`tmux select-layout -t ${SESSION_NAME} tiled`);
  }

  attach(): void {
    const child = nodeSpawn('tmux', ['attach', '-t', SESSION_NAME], {
      stdio: 'inherit',
    });
    child.on('close', () => {
      process.stdin.setRawMode?.(false);
      console.log(`\nDetached. Re-attach: tmux attach -t ${SESSION_NAME}`);
      console.log('Ctrl+C to stop renderer and kill tmux session.');
    });
  }

  ensurePane(room: string): string {
    if (this.panes.has(room)) return this.panes.get(room)!;

    const logPath = join(this.tmpDir!, `room-${room.replace(/[^a-zA-Z0-9_-]/g, '_')}.log`);
    writeFileSync(logPath, '');
    const paneId = this.exec(
      `tmux split-window -t ${SESSION_NAME} -P -F '#{pane_id}' "tail -f '${logPath}'"`
    ).trim();
    this.exec(`tmux select-pane -t '${paneId}' -T '${room}'`);
    this.exec(`tmux select-layout -t ${SESSION_NAME} tiled`);
    this.panes.set(room, paneId);
    this.paneLogPaths.set(paneId, logPath);
    return paneId;
  }

  updatePaneTitle(room: string, title: string): void {
    const paneId = this.panes.get(room);
    if (!paneId) return;
    const escaped = title.replace(/'/g, "'\\''");
    this.exec(`tmux select-pane -t '${paneId}' -T '${escaped}'`);
  }

  sendToPane(room: string, text: string): void {
    const paneId = this.panes.get(room);
    if (!paneId) return;
    this.appendToLog(paneId, text);
  }

  sendToOfficePane(text: string): void {
    if (!this.officePaneId) return;
    this.writeViaTty(this.officePaneId, text);
  }

  sendToEventPane(text: string): void {
    if (!this.eventPaneId) return;
    this.appendToLog(this.eventPaneId, text);
  }

  clearOfficePane(): void {
    if (!this.officePaneId) return;
    const tty = this.exec(`tmux display-message -t '${this.officePaneId}' -p '#{pane_tty}'`).trim();
    this.exec(`printf '\\033[2J\\033[H' > ${tty}`);
  }

  listPanes(): Map<string, string> {
    return new Map(this.panes);
  }

  destroy(): void {
    try {
      this.exec(`tmux kill-session -t ${SESSION_NAME}`);
    } catch { /* ignore */ }
    if (this.tmpDir) {
      try { rmSync(this.tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    this.panes.clear();
    this.paneLogPaths.clear();
    this.officePaneId = null;
    this.eventPaneId = null;
    this.tmpDir = null;
  }

  /** Append to the log file backing a tail -f pane (scrollable) */
  private appendToLog(paneId: string, text: string): void {
    const logPath = this.paneLogPaths.get(paneId);
    if (!logPath) return;
    appendFileSync(logPath, text + '\n');
  }

  /** Write directly to pane tty (not scrollable, used for office status) */
  private writeViaTty(paneId: string, text: string): void {
    const tty = this.exec(`tmux display-message -t '${paneId}' -p '#{pane_tty}'`).trim();
    const escaped = text.replace(/'/g, "'\\''");
    this.exec(`printf '%s\\n' '${escaped}' > ${tty}`);
  }
}
