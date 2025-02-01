import { Command } from 'commander';
import { generateTx } from '@commands/generateTx';
import { testTx } from '@/commands/testTx';
import { analyzeJson } from '@/commands/analyzeJson';
import { generateAuthzTx } from '@/commands/generateAuthzTx';
import { generateDaodaoTx } from '@/commands/generateDaodaoTx';

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

program
	.command('generateAuthzTx')
	.description('Generate separate authz transactions for withdraw and staking')
	.action(() =>
	{
		generateAuthzTx();
	});

program
	.command('generateDaodaoTx')
	.description('Generate a transaction for Daodao')
	.option('--decimals <number>', 'Number of decimals', '6')
	.option('--chainId <string>', 'Chain ID', 'bitsong-2b')
	.action((cmd) =>
	{
		const decimals = cmd.decimals ? parseInt(cmd.decimals, 10) : 6;
		const chainId = cmd.chainId || 'bitsong-2b';
		generateDaodaoTx(chainId, decimals);
	});

program.parse(process.argv);
