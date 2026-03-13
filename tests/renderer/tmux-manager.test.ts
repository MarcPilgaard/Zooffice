import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { TmuxManager } from '../../src/renderer/tmux-manager.js';

describe('TmuxManager', () => {
  let execCalls: string[];
  let mgr: TmuxManager;

  beforeEach(() => {
    execCalls = [];
    mgr = new TmuxManager((cmd) => {
      execCalls.push(cmd);
      if (cmd.includes('has-session')) throw new Error('no session');
      if (cmd.includes('new-session')) return '%0\n';
      if (cmd.includes('split-window')) return '%42\n';
      if (cmd.includes('pane_tty')) return '/dev/pts/1\n';
      return '';
    });
  });

  afterEach(() => {
    mgr.destroy();
  });

  it('initializes tmux session with office and event panes', () => {
    mgr.init();
    expect(execCalls.some(c => c.includes('new-session') && c.includes('cat'))).toBe(true);
    expect(execCalls.some(c => c.includes('split-window') && c.includes('tail -f'))).toBe(true);
    expect(execCalls.some(c => c.includes('history-limit'))).toBe(true);
  });

  it('creates pane for a room with tail -f', () => {
    mgr.init();
    const paneId = mgr.ensurePane('lobby');
    expect(paneId).toBe('%42');
    const roomSplit = execCalls.filter(c => c.includes('split-window') && c.includes('tail -f'));
    // One for event pane in init, one for room pane
    expect(roomSplit.length).toBe(2);
  });

  it('reuses pane for same room', () => {
    mgr.init();
    mgr.ensurePane('lobby');
    const splitCount = execCalls.filter(c => c.includes('split-window')).length;
    mgr.ensurePane('lobby');
    const splitCount2 = execCalls.filter(c => c.includes('split-window')).length;
    expect(splitCount2).toBe(splitCount);
  });

  it('sends room text by appending to log file', () => {
    mgr.init();
    mgr.ensurePane('lobby');
    mgr.sendToPane('lobby', 'hello world');
    // The pane ID from ensurePane is %42, find its log file
    // Since appendToLog writes to a real file, check no tmux exec for writing
    const writeExecs = execCalls.filter(c => c.includes('hello world'));
    expect(writeExecs.length).toBe(0); // no tmux exec, it's a file append
  });

  it('sends office text via tty', () => {
    mgr.init();
    mgr.sendToOfficePane('status update');
    expect(execCalls.some(c => c.includes('printf') && c.includes('status update') && c.includes('/dev/pts/1'))).toBe(true);
  });

  it('sends event text by appending to log file', () => {
    mgr.init();
    mgr.sendToEventPane('agent hired');
    // No tmux exec for the write itself
    const writeExecs = execCalls.filter(c => c.includes('agent hired'));
    expect(writeExecs.length).toBe(0);
  });

  it('lists panes', () => {
    mgr.init();
    mgr.ensurePane('lobby');
    mgr.ensurePane('kitchen');
    expect(mgr.listPanes().size).toBe(2);
  });

  it('destroys session and cleans up temp files', () => {
    mgr.init();
    mgr.ensurePane('lobby');
    mgr.destroy();
    expect(execCalls.some(c => c.includes('kill-session'))).toBe(true);
    expect(mgr.listPanes().size).toBe(0);
  });
});
