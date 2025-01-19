import { Command } from 'commander';
import { generateTx } from '@commands/generateTx';
import { testTx } from '@/commands/testTx';

const program = new Command();

program
	.command('generateTx')
	.description('Generate a transaction')
	.action(() =>
	{
		generateTx();
	});

program
	.command('testTx')
	.description('Check a transaction')
	.action(() =>
	{
		testTx();
	});

program.parse(process.argv);
