import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Office } from './office.js';
import { ProtocolHandler } from './protocol/handler.js';
import { Logger } from './logger.js';
import { serializeMessage } from '../shared/protocol.js';
import type { ServerMessage, BroadcastMessage } from '../shared/protocol.js';

export interface ServerOptions {
  port: number;
  host?: string;
  logsDir?: string;
}

export class ZoofficeServer {
  private wss: WebSocketServer | null = null;
  private office: Office;
  private handler: ProtocolHandler;
  private renderers = new Set<WebSocket>();
  private logger: Logger;

  constructor(logsDir?: string) {
    this.logger = new Logger(logsDir);
    this.office = new Office((msg) => this.broadcastToRenderers(msg), undefined, this.logger);
    this.handler = new ProtocolHandler(this.office);
  }

  getOffice(): Office {
    return this.office;
  }

  getLogFilePath(): string {
    return this.logger.filePath;
  }

  start(options: ServerOptions): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: options.port, host: options.host }, () => {
        this.logger.log('server', { event: 'start', port: options.port, host: options.host, logFile: this.logger.filePath });
        resolve();
      });

      this.wss.on('connection', (ws, req) => {
        const isRenderer = req.url === '/render';
        if (isRenderer) {
          this.renderers.add(ws);
          this.logger.log('server', { event: 'renderer_connected' });
          ws.on('close', () => {
            this.renderers.delete(ws);
            this.logger.log('server', { event: 'renderer_disconnected' });
          });
          return;
        }

        const connectionId = uuidv4();
        this.logger.log('server', { event: 'client_connected', connectionId });
        const send = (msg: ServerMessage) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(serializeMessage(msg));
          }
        };

        ws.on('message', (data) => {
          this.handler.handleRaw(data.toString(), send, connectionId);
        });

        ws.on('close', () => {
          this.logger.log('server', { event: 'client_disconnected', connectionId });
          this.office.disconnectAgent(connectionId);
        });
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.log('server', { event: 'stop' });
      this.logger.close();
      if (!this.wss) { resolve(); return; }
      this.wss.close((err) => {
        if (err) reject(err); else resolve();
      });
      // Close all connections
      this.wss.clients.forEach(c => c.terminate());
      this.wss = null;
    });
  }

  private broadcastToRenderers(msg: BroadcastMessage): void {
    const data = serializeMessage(msg);
    for (const ws of this.renderers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}
