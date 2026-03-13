import { execFile } from 'node:child_process';
import type { ToolDefinition } from './types.js';

export const bashTool: ToolDefinition = {
  name: 'bash',
  description: 'Run a shell command (30s timeout, output truncated to 4000 chars). Args: { command: string }',
  kibbleCost: 5,
  async execute(args) {
    const command = args.command as string;
    if (!command) return { success: false, output: 'Missing required arg: command' };

    return new Promise((resolve) => {
      execFile('bash', ['-c', command], { timeout: 30_000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, output: `${stderr || error.message}`.slice(0, 4000) });
        } else {
          resolve({ success: true, output: (stdout + stderr).slice(0, 4000) });
        }
      });
    });
  },
};
