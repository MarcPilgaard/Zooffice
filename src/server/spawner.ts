import { spawn } from 'node:child_process';
import type { AgentConfig } from './agent/types.js';

export interface AgentSpawner {
  /** Spawn a client container/process for a newly hired agent. */
  spawn(config: AgentConfig, serverUrl: string): void;
}

export interface DockerSpawnerOptions {
  image: string;
  /** Docker network to attach containers to (default: host) */
  network?: string;
  /** Environment variables to forward into each agent container */
  env?: Record<string, string>;
}

/** Env vars forwarded from the server process into each agent container. */
const FORWARDED_ENV_VARS = [
  'ANTHROPIC_API_KEY',   // claude code auth
  'GH_TOKEN',           // github CLI auth
  'GITHUB_TOKEN',       // github CLI auth (alt)
];

export class DockerSpawner implements AgentSpawner {
  private image: string;
  private network: string;
  private env: Record<string, string>;

  constructor(opts: DockerSpawnerOptions) {
    this.image = opts.image;
    this.network = opts.network ?? 'host';
    // Collect env vars: explicit opts override auto-forwarded ones
    this.env = { ...this.collectForwardedEnv(), ...opts.env };
  }

  /** Pick up relevant env vars from the server's own environment. */
  private collectForwardedEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    for (const key of FORWARDED_ENV_VARS) {
      if (process.env[key]) {
        env[key] = process.env[key]!;
      }
    }
    return env;
  }

  spawn(config: AgentConfig, serverUrl: string): void {
    const containerName = `zooffice-${config.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

    const envArgs = Object.entries(this.env).flatMap(([k, v]) => ['-e', `${k}=${v}`]);

    const args = [
      'run', '--rm',
      '--name', containerName,
      '--network', this.network,
      ...envArgs,
      this.image,
      '--server', serverUrl,
      '--name', config.name,
      '--title', config.title,
      '--role', config.role,
      '--goal', config.goal,
    ];

    console.log(`[docker-spawner] Spawning container: ${containerName}`);
    const child = spawn('docker', args, {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
    console.log(`[docker-spawner] Container ${containerName} started (pid: ${child.pid})`);
  }
}
