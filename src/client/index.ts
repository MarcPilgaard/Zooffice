import { Command } from 'commander';
import { Bridge } from './bridge.js';

const program = new Command();

program
  .name('zooffice-client')
  .description('Zooffice agent client');

program
  .command('connect')
  .description('Connect to a Zooffice server as an agent')
  .option('-s, --server <url>', 'Server WebSocket URL', 'ws://localhost:3000')
  .requiredOption('-n, --name <string>', 'Agent name')
  .requiredOption('-t, --title <string>', 'Agent title')
  .option('-r, --role <string>', 'Agent role', 'worker')
  .requiredOption('-g, --goal <string>', 'Agent goal')
  .action(async (opts) => {
    const bridge = new Bridge({
      serverUrl: opts.server,
      name: opts.name,
      title: opts.title,
      role: opts.role,
      goal: opts.goal,
    });

    await bridge.connect();
    console.log(`Connected to ${opts.server} as ${opts.name}`);

    process.on('SIGINT', () => {
      bridge.disconnect();
      process.exit(0);
    });
  });

program.parse(process.argv);
