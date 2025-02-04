import fs from 'fs';
import path from 'path';
import {
	MsgExec,
	MsgAny,
} from '@/types/bitsong';

interface MessagesFile
{
	withdraw: Record<string, MsgAny[]>;
	staking: Record<string, MsgAny[]>;
}

/**
 * Generate separate authz transactions for withdraw and staking.
 * The transactions are written to tx-1.json and tx-2.json.
 * @param separateFiles boolean
 * @return void
 */
export async function generateAuthzTx(separateFiles: boolean) : Promise<void>
{
	// 1) Load messages.json
	const messagesPath = path.resolve(__dirname, '../../data/messages.json');
	const raw = fs.readFileSync(messagesPath, 'utf-8');
	const messages: MessagesFile = JSON.parse(raw);
	
	// 2) Build the arrays of MsgExec
	//    - one array for withdraw
	//    - one array for staking
	const withdrawExec: MsgExec[] = buildExecArray(messages.withdraw);
	const stakingExec: MsgExec[] = buildExecArray(messages.staking);
	
	// 3) Write them to separate JSON files

	// File 1: tx-1.json (withdraw part)
	const tx1Path = path.resolve(__dirname, '../../data/tx-1.json');
	fs.writeFileSync(tx1Path, JSON.stringify(withdrawExec, null, 2), 'utf-8');
	console.log(`Withdraw Authz Exec TX written to: ${tx1Path}`);

	// File 2: tx-2.json (staking part)
	const tx2Path = path.resolve(__dirname, '../../data/tx-2.json');
	fs.writeFileSync(tx2Path, JSON.stringify(stakingExec, null, 2), 'utf-8');
	console.log(`Staking Authz Exec TX written to: ${tx2Path}`);
	
	// 4) Optionally write one file per delegator
	if (separateFiles)
	{
		// Write one file per delegator for withdraw
		for (const msgExec of withdrawExec)
		{
			const delegatorAddress = msgExec.value.grantee;
			const filePath = path.resolve(__dirname, `../../data/withdraw-${delegatorAddress}.json`);
			fs.writeFileSync(filePath, JSON.stringify(msgExec, null, 2), 'utf-8');
			console.log(`Withdraw Authz Exec TX written to: ${filePath}`);
		}
		
		// Write one file per delegator for staking
		for (const msgExec of stakingExec)
		{
			const delegatorAddress = msgExec.value.grantee;
			const filePath = path.resolve(__dirname, `../../data/staking-${delegatorAddress}.json`);
			fs.writeFileSync(filePath, JSON.stringify(msgExec, null, 2), 'utf-8');
			console.log(`Staking Authz Exec TX written to: ${filePath}`);
		}
	}
	else
	{
		// File 1: tx-1.json (withdraw part)
		const tx1Path = path.resolve(__dirname, '../../data/tx-1.json');
		fs.writeFileSync(tx1Path, JSON.stringify(withdrawExec, null, 2), 'utf-8');
		console.log(`Withdraw Authz Exec TX written to: ${tx1Path}`);
		
		// File 2: tx-2.json (staking part)
		const tx2Path = path.resolve(__dirname, '../../data/tx-2.json');
		fs.writeFileSync(tx2Path, JSON.stringify(stakingExec, null, 2), 'utf-8');
		console.log(`Staking Authz Exec TX written to: ${tx2Path}`);
	}
}

/**
 * Helper function that takes a mapping of delegatorAddress -> MsgAny[]
 * and converts it into an array of MsgExec.
 * Each delegatorAddress yields one MsgExec.
 * @param msgsByDelegator Record<string, MsgAny[]>
 * @return MsgExec[]
 */
function buildExecArray(msgsByDelegator: Record<string, MsgAny[]>): MsgExec[]
{
	const execArray: MsgExec[] = [];

	for (const [delegatorAddress, msgs] of Object.entries(msgsByDelegator))
	{
		const msgExec: MsgExec = {
			typeUrl: '/cosmos.authz.v1beta1.MsgExec',
			value: {
				grantee: delegatorAddress,
				msgs: msgs,
			},
		};
		execArray.push(msgExec);
	}

	return execArray;
}
