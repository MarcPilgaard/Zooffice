import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ZoofficeServer } from '../../src/server/server.js';
import WebSocket from 'ws';

describe('WebSocket integration', () => {
  let server: ZoofficeServer;
  const PORT = 9876;

  beforeEach(async () => {
    const tmpLogsDir = mkdtempSync(join(tmpdir(), 'zooffice-test-'));
    server = new ZoofficeServer(tmpLogsDir);
    await server.start({ port: PORT });
  });

  afterEach(async () => {
    await server.stop();
  });

  function connect(path = ''): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${PORT}${path}`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  function sendAndReceive(ws: WebSocket, msg: object): Promise<object> {
    return new Promise((resolve) => {
      ws.once('message', (data) => resolve(JSON.parse(data.toString())));
      ws.send(JSON.stringify(msg));
    });
  }

  it('registers an agent via WebSocket', async () => {
    const ws = await connect();
    try {
      const response = await sendAndReceive(ws, {
        type: 'register',
        name: 'Rex',
        title: 'CEO',
        role: 'leader',
        goal: 'lead',
      });
      expect(response).toMatchObject({ type: 'registered' });
      const reg = response as { agentId: string; office: { officeName: string } };
      expect(reg.agentId).toBeTruthy();
      expect(reg.office.officeName).toBe('Zooffice HQ');
    } finally {
      ws.close();
    }
  });

  it('executes a tool via WebSocket', async () => {
    const ws = await connect();
    try {
      // Register first
      await sendAndReceive(ws, {
        type: 'register', name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead',
      });

      // Enter room
      const result = await sendAndReceive(ws, {
        type: 'tool_invoke', tool: 'room-enter', args: { room: 'lobby' }, requestId: 'r1',
      });
      expect(result).toMatchObject({ type: 'tool_result', requestId: 'r1', success: true });
    } finally {
      ws.close();
    }
  });

  it('broadcasts room events to renderer', async () => {
    const renderer = await connect('/render');
    const client = await connect();

    try {
      // Register
      await sendAndReceive(client, {
        type: 'register', name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead',
      });

      // Listen for broadcast
      const broadcastPromise = new Promise<object>((resolve) => {
        renderer.once('message', (data) => resolve(JSON.parse(data.toString())));
      });

      // Enter room (triggers broadcast)
      client.send(JSON.stringify({
        type: 'tool_invoke', tool: 'room-enter', args: { room: 'lobby' }, requestId: 'r1',
      }));

      const broadcast = await broadcastPromise;
      expect(broadcast).toMatchObject({ type: 'room_event', room: 'lobby', event: 'join' });
    } finally {
      renderer.close();
      client.close();
    }
  });

  it('two agents can message each other through a room', async () => {
    const ws1 = await connect();
    const ws2 = await connect();

    try {
      // Register both
      await sendAndReceive(ws1, { type: 'register', name: 'Rex', title: 'CEO', role: 'leader', goal: 'lead' });
      await sendAndReceive(ws2, { type: 'register', name: 'Fido', title: 'CTO', role: 'tech', goal: 'code' });

      // Both enter lobby
      await sendAndReceive(ws1, { type: 'tool_invoke', tool: 'room-enter', args: { room: 'lobby' }, requestId: 'r1' });
      await sendAndReceive(ws2, { type: 'tool_invoke', tool: 'room-enter', args: { room: 'lobby' }, requestId: 'r2' });

      // ws2 listens for message
      const msgPromise = new Promise<object>((resolve) => {
        ws2.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'message') resolve(msg);
        });
      });

      // Rex talks
      ws1.send(JSON.stringify({
        type: 'tool_invoke', tool: 'talk', args: { to: 'lobby', message: 'Hello Fido!' }, requestId: 'r3',
      }));

      const received = await msgPromise;
      expect(received).toMatchObject({ type: 'message', from: 'Rex', room: 'lobby', text: 'Hello Fido!' });
    } finally {
      ws1.close();
      ws2.close();
    }
  });
});
