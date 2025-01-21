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
	.description('Generate a transaction with options to output to Excel and ignore pending rewards')
	.option('--outputExcel', 'Output the result in an Excel file')
	.option('--ignoreRewards', 'Ignore pending rewards in the transaction')
	.action((cmd) =>
	{
		const outputExcel = !!cmd.outputExcel;
		const ignoreRewards = !!cmd.ignoreRewards;
		generateTx(outputExcel, !ignoreRewards);
	});

program
	.command('testTx')
	.description('Check a transaction')
	.action(() =>
	{
		testTx();
	});

program.parse(process.argv);
