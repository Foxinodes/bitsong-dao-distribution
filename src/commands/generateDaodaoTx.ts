import fs from 'fs';
import path from 'path';
import {
	MsgAny,
} from '@/types/bitsong';

interface MessagesFile {
  withdraw: Record<string, MsgAny[]>;
  staking: Record<string, MsgAny[]>;
}

/**
 * Generate separate Daodao transactions for withdraw and staking.
 * The transactions are written to daodao-tx-1.json and daodao-tx-2.json.
 */
export async function generateDaodaoTx()
{
	// 1) Load messages.json
	const messagesPath = path.resolve(__dirname, '../../data/messages.json');
	const raw = fs.readFileSync(messagesPath, 'utf-8');
	const messages: MessagesFile = JSON.parse(raw);
	
	// 2) Build actions for withdraw and staking
	const withdrawActions = buildDaodaoActions(messages.withdraw);
	const stakingActions = buildDaodaoActions(messages.staking);
	
	// 3) Wrap them in the final Daodao JSON structure and write to files
	
	// File 1: daodao-tx-1.json (withdraw part)
	const daodaoTx1Path = path.resolve(__dirname, '../../data/daodao-tx-1.json');
	fs.writeFileSync(
		daodaoTx1Path,
		JSON.stringify({ actions: withdrawActions }, null, 2),
		'utf-8'
	);
	console.log(`Withdraw Daodao TX written to: ${daodaoTx1Path}`);
	
	// File 2: daodao-tx-2.json (staking part)
	const daodaoTx2Path = path.resolve(__dirname, '../../data/daodao-tx-2.json');
	fs.writeFileSync(
		daodaoTx2Path,
		JSON.stringify({ actions: stakingActions }, null, 2),
		'utf-8'
	);
	
	console.log(`Staking Daodao TX written to: ${daodaoTx2Path}`);
}

/**
 * Helper function that converts a mapping of delegatorAddress -> MsgAny[]
 * into an array of Daodao 'actions'.
 * @param msgsByDelegator Record<string, MsgAny[]>
 * @return any[]
 */
function buildDaodaoActions(msgsByDelegator: Record<string, MsgAny[]>): any[]
{
	const actions = [];
	for (const [delegatorAddress, msgs] of Object.entries(msgsByDelegator))
	{
		actions.push({
			key: 'execute',
			data: {
				stargate: {
					typeUrl: '/cosmos.authz.v1beta1.MsgExec',
					value: {
						grantee: delegatorAddress,
						msgs: msgs,
					},
				},
			},
		});
	}
	return actions;
}