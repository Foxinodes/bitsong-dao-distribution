import fs from 'fs';
import path from 'path';
import
{
	MsgAny,
	DaodaoAction,
} from '@/types/bitsong';

interface MessagesFile
{
	withdraw: Record<string, MsgAny[]>;
	staking: Record<string, MsgAny[]>;
}

/**
 * Generate separate Daodao transactions for withdraw and staking.
 * The transactions are written to daodao-tx-1.json and daodao-tx-2.json.
 */
export async function generateDaodaoTx(chainId: string, decimals: number)
{
	// 1) Load messages.json
	const messagesPath = path.resolve(__dirname, '../../data/messages.json');
	const raw = fs.readFileSync(messagesPath, 'utf-8');
	const messages: MessagesFile = JSON.parse(raw);
	
	// 2) Build actions for withdraw and staking
	const withdrawActions = buildDaodaoActions(messages.withdraw, chainId, decimals);
	const stakingActions = buildDaodaoActions(messages.staking, chainId, decimals);
	
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
function buildDaodaoActions(msgsByDelegator: Record<string, MsgAny[]>, chainId: string, decimals: number): any[]
{
	const actions = [];
	for (const [delegatorAddress, msgs] of Object.entries(msgsByDelegator))
	{
		const convertedMsgs = msgs.map((msg) => convertMsg(msg, chainId, decimals));
		
		if (convertedMsgs.length === 1 && convertedMsgs[0].actionKey === 'authzExec')
		{
			actions.push(convertedMsgs[0]);
		}
		else
		{
			actions.push({
				key: 'authzExec',
				data: {
					chainId: chainId,
					address: delegatorAddress,
					_actionData: convertedMsgs,
				},
			});
		}
	}
	return actions;
}

/**
 * Convert a MsgAny to a DaodaoAction.
 * @param msg message to convert
 * @return DaodaoAction
 */
function convertMsg(msg: MsgAny, chainId: string, decimals: number): DaodaoAction
{
	let amount: number = 0;

	// Check if the amount is present and convert it to a number
	if ('amount' in msg.value && msg.value.amount.amount)
	{
		// Convert ubtsg amount to btsg
		const factor = Math.pow(10, decimals);
		amount = parseInt(msg.value.amount.amount, 10) / factor;
	}
	
	switch (msg.typeUrl)
	{
		case '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward':
			return {
				actionKey: 'manageStaking',
				data: {
					chainId: chainId,
					type: 'withdraw_delegator_reward',
					validator: msg.value.validatorAddress,
				},
			};
		case '/cosmos.staking.v1beta1.MsgDelegate':
			return {
				actionKey: 'manageStaking',
				data: {
					chainId: chainId,
					type: 'delegate',
					validator: msg.value.validatorAddress,
					amount: amount,
				},
			};
		case '/cosmos.staking.v1beta1.MsgBeginRedelegate':
			return {
				actionKey: 'manageStaking',
				data: {
					chainId: chainId,
					type: 'redelegate',
					validator: msg.value.validatorSrcAddress,
					toValidator: msg.value.validatorDstAddress,
					amount: amount,
				},
			};
		case '/cosmos.staking.v1beta1.MsgUndelegate':
			return {
				actionKey: 'manageStaking',
				data: {
					chainId: chainId,
					type: 'undelegate',
					validator: msg.value.validatorAddress,
					amount: amount,
				},
			};
		default:
			throw new Error('Unsupported message type');
	}
}
