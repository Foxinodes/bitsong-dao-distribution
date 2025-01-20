import fs from 'fs';
import path from 'path';
import { utils, writeFile as xlsxWriteFile } from 'xlsx';

/**
 * Types adapted to the structure of allocations.json.
 * You can adjust if your actual JSON has different fields.
 */
interface DelegatorInfo
{
	address: string;
	amount: number;
	rewards: number;
}

interface ValidatorInfo
{
	address: string;
	name: string;
	total_amount: number; // Current delegation
	new_delegations: number; // Target delegation
	delegators: DelegatorInfo[];
}

interface AllocationsData
{
	delegations: ValidatorInfo[];
}

/**
 * This script:
 * 1) Reads allocations.json
 * 2) Calculates total current delegations, total rewards, total new delegations
 * 3) Generates an Excel file (allocations_summary.xlsx) with one row per validator
 *    listing current delegation, new delegation, difference, and total rewards.
 */
export async function analyzeJson()
{
	// 1) Load the allocations.json file
	const dataPath = path.resolve(__dirname, '../../data/allocations.json');
	const rawData = fs.readFileSync(dataPath, 'utf-8');
	const allocations: AllocationsData = JSON.parse(rawData);

	// 2) Calculate sums:
	//    - sumCurrent => total of current delegations
	//    - sumRewards => total of all rewards
	//    - sumTarget  => total of new delegations
	let sumCurrent = 0;
	let sumRewards = 0;
	let sumTarget = 0;

	// We also collect data rows for the Excel sheet
	// The first row = header
	const rows: any[][] = [];
	rows.push([
		'ValidatorAddress',
		'ValidatorName',
		'CurrentDelegation',
		'NewDelegation',
		'Difference',
		'TotalRewards',
	]);

	// 3) Iterate over all validators
	for (const val of allocations.delegations)
	{
		const current = val.total_amount;
		const target = val.new_delegations;
		const difference = target - current;

		// sum of rewards for all delegators of this validator
		const validatorRewards = val.delegators.reduce(
			(acc, d) => acc + (d.rewards ?? 0),
			0
		);

		// Update global sums
		sumCurrent += current;
		sumRewards += validatorRewards;
		sumTarget += target;

		// Add a row to our Excel data
		rows.push([
			val.address,
			val.name,
			Number(current.toFixed(6)),
			Number(target.toFixed(6)),
			Number(difference.toFixed(6)),
			Number(validatorRewards.toFixed(6)),
		]);
	}

	// 4) Print the global sums in the console
	console.log('=== Allocations summary ===');
	console.log(`Total Current Delegations: ${sumCurrent.toFixed(6)} BTSG`);
	console.log(`Total Rewards: ${sumRewards.toFixed(6)} BTSG`);
	console.log(`Total New Delegations (Target): ${sumTarget.toFixed(6)} BTSG`);

	// 5) Create a workbook and convert rows into a worksheet
	const worksheet = utils.aoa_to_sheet(rows);
	const workbook = utils.book_new();
	utils.book_append_sheet(workbook, worksheet, 'Allocations');

	// 6) Write the Excel file
	const excelOutputPath = path.resolve(__dirname, '../../data/allocations_summary.xlsx');
	xlsxWriteFile(workbook, excelOutputPath);
	console.log(`Excel file written to: ${excelOutputPath}`);
}
