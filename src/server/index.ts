import { Command } from 'commander';
import { ZoofficeServer } from './server.js';

const program = new Command();

program
  .name('zooffice-server')
  .description('Zooffice agent orchestration server');

program
  .command('start')
  .description('Start the Zooffice server')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('-h, --host <string>', 'Host to bind', '0.0.0.0')
  .option('--logs-dir <path>', 'Directory for log files', 'logs')
  .action(async (opts) => {
    const server = new ZoofficeServer(opts.logsDir);
    const port = parseInt(opts.port, 10);
    await server.start({ port, host: opts.host });
    console.log(`Zooffice server running on ws://${opts.host}:${port}`);
    console.log(`Logging to ${server.getLogFilePath()}`);
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    });
  });

program.parse(process.argv);
