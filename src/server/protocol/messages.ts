import type { ClientMessage, RegisterMessage, ToolInvokeMessage, TalkMessage } from '../../shared/protocol.js';

export function validateRegister(msg: unknown): msg is RegisterMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.type === 'register' &&
    typeof m.name === 'string' && m.name.length > 0 &&
    typeof m.title === 'string' &&
    typeof m.role === 'string' &&
    typeof m.goal === 'string';
}

export function validateToolInvoke(msg: unknown): msg is ToolInvokeMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.type === 'tool_invoke' &&
    typeof m.tool === 'string' && m.tool.length > 0 &&
    typeof m.args === 'object' && m.args !== null &&
    typeof m.requestId === 'string' && m.requestId.length > 0;
}

export function validateTalk(msg: unknown): msg is TalkMessage {
  if (typeof msg !== 'object' || msg === null) return false;
  const m = msg as Record<string, unknown>;
  return m.type === 'talk' &&
    typeof m.to === 'string' && m.to.length > 0 &&
    typeof m.message === 'string';
}

export function validateClientMessage(msg: unknown): msg is ClientMessage {
  return validateRegister(msg) || validateToolInvoke(msg) || validateTalk(msg);
}
