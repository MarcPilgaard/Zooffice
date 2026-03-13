import chalk from 'chalk';
import type { RoomEvent, OfficeEvent, StateSnapshot } from '../shared/protocol.js';

const AGENT_COLORS = [
  chalk.cyan, chalk.green, chalk.yellow, chalk.magenta,
  chalk.blue, chalk.red, chalk.white,
];

const agentColorMap = new Map<string, (text: string) => string>();
let colorIndex = 0;

function getAgentColor(agent: string): (text: string) => string {
  if (!agentColorMap.has(agent)) {
    agentColorMap.set(agent, AGENT_COLORS[colorIndex % AGENT_COLORS.length]);
    colorIndex++;
  }
  return agentColorMap.get(agent)!;
}

let messageIndex = 0;

export function formatRoomEvent(evt: RoomEvent): string {
  const color = getAgentColor(evt.agent);
  switch (evt.event) {
    case 'join':
      return chalk.dim(`→ ${color(evt.agent)} entered ${evt.room}`);
    case 'leave':
      return chalk.dim(`← ${color(evt.agent)} left ${evt.room}`);
    case 'message': {
      const text = `${color(evt.agent)}: ${evt.text ?? ''}`;
      const line = messageIndex++ % 2 === 0 ? text : chalk.dim(text);
      return `\n${line}`;
    }
  }
}

const MAX_DETAIL_LEN = 60;

function formatToolDetail(tool?: string, args?: Record<string, unknown>): string {
  if (!args) return '';
  let detail = '';
  switch (tool) {
    case 'bash': {
      const cmd = String(args.command ?? '').slice(0, MAX_DETAIL_LEN);
      detail = cmd ? ` ${cmd}${String(args.command ?? '').length > MAX_DETAIL_LEN ? '…' : ''}` : '';
      break;
    }
    case 'room-enter':
      detail = ` → ${args.room ?? '?'}`;
      break;
    case 'room-leave':
      detail = ` ← ${args.room ?? '?'}`;
      break;
    case 'talk':
      detail = ` [${args.to ?? '?'}]`;
      break;
    case 'hire':
      detail = ` ${args.name ?? '?'} (${args.title ?? '?'})`;
      break;
    case 'transfer-kibble':
      detail = ` ${args.amount ?? '?'}🫘 → ${args.to ?? '?'}`;
      break;
    default: {
      const summary = JSON.stringify(args).slice(0, MAX_DETAIL_LEN);
      detail = ` ${summary}${JSON.stringify(args).length > MAX_DETAIL_LEN ? '…' : ''}`;
    }
  }
  return chalk.dim(detail);
}

export function formatOfficeEvent(evt: OfficeEvent): string {
  switch (evt.event) {
    case 'agent_spawned': {
      const d = evt.data as { name?: string; title?: string; hiredBy?: string };
      const hired = d.hiredBy ? ` (hired by ${d.hiredBy})` : '';
      return chalk.green(`★ ${d.name ?? 'Unknown'} (${d.title ?? ''}) joined the office${hired}`);
    }
    case 'agent_disconnected': {
      const d = evt.data as { id?: string };
      return chalk.red(`✖ Agent ${d.id ?? 'unknown'} disconnected`);
    }
    case 'kibble_transfer': {
      const d = evt.data as { from?: string; to?: string; amount?: number };
      return chalk.yellow(`${d.from} → ${d.to}: ${d.amount} kibble`);
    }
    case 'tool_used': {
      const d = evt.data as { agent?: string; tool?: string; args?: Record<string, unknown>; cost?: number; success?: boolean; output?: string };
      const color = getAgentColor(d.agent ?? 'unknown');
      const cost = d.cost ? chalk.yellow(` -${d.cost}🫘`) : '';
      const prefix = d.success ? '' : chalk.red('FAIL ');
      const reason = !d.success && d.output ? chalk.dim(` (${d.output})`) : '';
      const detail = formatToolDetail(d.tool, d.args);
      return `${color(d.agent ?? '?')} ${prefix}${chalk.bold(d.tool ?? '?')}${detail}${cost}${reason}`;
    }
    default:
      return chalk.dim(JSON.stringify(evt));
  }
}

export function getRoomMembers(snap: StateSnapshot): Map<string, string[]> {
  const rooms = new Map<string, string[]>();
  for (const a of snap.agents) {
    for (const room of a.rooms) {
      if (!rooms.has(room)) rooms.set(room, []);
      rooms.get(room)!.push(a.name);
    }
  }
  return rooms;
}

export function formatStateSnapshot(snap: StateSnapshot): string[] {
  const lines: string[] = [];
  lines.push(chalk.bold(`── ${snap.officeName} ──`));
  lines.push('');
  if (snap.agents.length === 0) {
    lines.push(chalk.dim('  No agents'));
  } else {
    for (const a of snap.agents) {
      const status = a.connected ? chalk.green('●') : chalk.red('○');
      const rooms = a.rooms.length > 0 ? chalk.dim(` → ${a.rooms.join(', ')}`) : '';
      const color = getAgentColor(a.name);
      lines.push(`  ${status} ${color(a.name)} ${chalk.dim(`(${a.title})`)} ${chalk.yellow(`${a.kibble}🫘`)}${rooms}`);
    }
  }
  lines.push('');
  if (snap.rooms.length > 0) {
    lines.push(chalk.dim(`  Rooms: ${snap.rooms.join(', ')}`));
  }
  return lines;
}
