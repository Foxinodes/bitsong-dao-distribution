import { Command } from 'commander';
import { generateTx } from '@commands/generateTx';
import { testTx } from '@/commands/testTx';
import { analyzeJson } from '@/commands/analyzeJson';

const program = new Command();

program
	.command('analyzeJson')
	.description('Analyze the allocations.json file')
	.action(() =>
	{
		analyzeJson();
	});

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
