import fs from 'fs';
import path from 'path';
import {
	ValidatorInfo,
	MsgAny,
} from '@/types/bitsong';

export async function testTx()
{
	console.log('Testing transactions...');
	
	// Load allocations from file
	const allocationsPath = path.resolve(__dirname, '../../data/allocations.json');
	const rawAllocations = fs.readFileSync(allocationsPath, 'utf-8');
	const allocations = JSON.parse(rawAllocations);
	
	// Load messages from file
	const messagesPath = path.resolve(__dirname, '../../data/messages.json');
	const rawMessages = fs.readFileSync(messagesPath, 'utf-8');
	const parsed = JSON.parse(rawMessages);
	
	// Expected object: { withdraw: Record<string, MsgAny[]>, staking: Record<string, MsgAny[]> }
	const withdrawMsgsByDelegator = parsed.withdraw as Record<string, MsgAny[]>;
	const stakingMsgsByDelegator = parsed.staking as Record<string, MsgAny[]>;
	
	// Extract validators
	const validators = allocations.delegations as ValidatorInfo[];
	
	// Parameters
	const denom = 'ubtsg';
	const millionFactor = 1_000_000;
	// => Declare the liquid balance map
	const liquidBalanceByDelegator: Record<string, number> = {};
	
	// Withdraw rewards (which add to liquidBalanceByDelegator)
	console.log('Simulating withdrawals...');
	let afterWithdraw = simulateMessages(
		validators,
		withdrawMsgsByDelegator,
		denom,
		millionFactor,
		liquidBalanceByDelegator
	);
	
	// Execute MsgBeginRedelegate / MsgUndelegate / MsgDelegate
	console.log('\nSimulating staking messages...');
	let finalValidators = simulateMessages(
		afterWithdraw,
		stakingMsgsByDelegator,
		denom,
		millionFactor,
		liquidBalanceByDelegator
	);
	
	// Check final_amount vs new_delegations
	checkFinalBalances(finalValidators);
	
	// Display remaining liquid balances
	console.log('\nLiquid balances:');
	for (const [addr, bal] of Object.entries(liquidBalanceByDelegator))
	{
		console.log(`- ${addr}: ${bal / millionFactor} BTSG`);
	}
}
/**
 * Simulates the application of a set of messages (by delegator).
 * - Handles:
 *   - MsgWithdrawDelegatorReward => modifies liquidBalance
 *   - MsgBeginRedelegate => moves stake from one validator to another
 *   - MsgUndelegate => removes stake
 *   - MsgDelegate => adds to stake by consuming liquidBalance
 */
function simulateMessages(
	initialValidators: ValidatorInfo[],
	msgsByDelegator: Record<string, MsgAny[]>,
	denom: string,
	millionFactor: number,
	liquidBalanceByDelegator: Record<string, number>,
): ValidatorInfo[]
{
	// Deep copy the initial validators
	const validatorsCopy = JSON.parse(JSON.stringify(initialValidators)) as ValidatorInfo[];
	
	// Convert total_amount to ubtsg, etc.
	const enriched = validatorsCopy.map((v) =>
	{
		const totalAmountUbtsg = Math.floor(v.total_amount * millionFactor);
		const delegators = v.delegators.map((d) => ({
			...d,
			amountUbtsg: Math.floor(d.amount * millionFactor),
		}));
		return { ...v, totalAmountUbtsg, delegators };
	});
	
	// Indexing
	const valMap = new Map<string, typeof enriched[number]>();
	for (const val of enriched)
	{
		valMap.set(val.address, val);
	}
	// Iterate through all messages
	for (const [delegAddr, msgs] of Object.entries(msgsByDelegator))
	{
		for (const msg of msgs)
		{
			if (msg.typeUrl === '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward')
			{
				const { delegatorAddress, validatorAddress } = msg.value;
				const vInfo = valMap.get(validatorAddress);
				if (vInfo)
				{
					// Find the delegator info in the validator
					const dInfo = vInfo.delegators.find((d) => d.address === delegatorAddress);
					if (dInfo)
					{
						const rewardUbtsg = Math.floor((dInfo.rewards ?? 0) * millionFactor);
						// Add to liquidBalanceByDelegator
						if (!liquidBalanceByDelegator[delegatorAddress])
						{
							liquidBalanceByDelegator[delegatorAddress] = 0;
						}
						liquidBalanceByDelegator[delegatorAddress] += rewardUbtsg;
						console.log(`(Sim) WithdrawRewards: +${rewardUbtsg} ubtsg to delegator=${delegatorAddress}`);
						// We set dInfo.rewards = 0 to avoid “withdrawing” it twice
						dInfo.rewards = 0;
					}
				}
			}
			else if (msg.typeUrl === '/cosmos.staking.v1beta1.MsgBeginRedelegate')
			{
				const { delegatorAddress, validatorSrcAddress, validatorDstAddress, amount } = msg.value;
				const amtNum = Number(amount.amount);
				if (amount.denom !== denom)
				{
					console.warn(`MsgBeginRedelegate: denom=${amount.denom}, expected=${denom}`);
				}
				const srcVal = valMap.get(validatorSrcAddress);
				const dstVal = valMap.get(validatorDstAddress);
				if (!srcVal || !dstVal)
				{
					console.warn(`Invalid re‐delegate: srcVal=${validatorSrcAddress}, dstVal=${validatorDstAddress}`);
					continue;
				}
				const srcBal = getDelegatorBalance(srcVal, delegatorAddress);
				if (srcBal < amtNum)
				{
					console.warn(`Redelegate error: delegator ${delegAddr} tries to move ${amtNum} but only has ${srcBal}`);
					continue;
				}
				// Apply the balance change
				srcVal.totalAmountUbtsg -= amtNum;
				updateDelegatorBalance(srcVal, delegatorAddress, srcBal - amtNum, millionFactor);
				
				dstVal.totalAmountUbtsg += amtNum;
				const dstBal = getDelegatorBalance(dstVal, delegatorAddress);
				updateDelegatorBalance(dstVal, delegatorAddress, dstBal + amtNum, millionFactor);
				console.log(`(Sim) Redelegate: ${amtNum} ubtsg from ${validatorSrcAddress} to ${validatorDstAddress} for delegator=${delegAddr}`);
			}
			else if (msg.typeUrl === '/cosmos.staking.v1beta1.MsgUndelegate')
			{
				const { delegatorAddress, validatorAddress, amount } = msg.value;
				const amtNum = Number(amount.amount);
				if (amount.denom !== denom)
				{
					console.warn(`MsgUndelegate: denom=${amount.denom}, expected=${denom}`);
				}
				const val = valMap.get(validatorAddress);
				if (!val)
				{
					console.warn(`Invalid undelegate: val=${validatorAddress}`);
					continue;
				}
				const srcBal = getDelegatorBalance(val, delegatorAddress);
				if (srcBal < amtNum)
				{
					console.warn(`Undelegate error: delegator ${delegAddr} tries to remove ${amtNum} but only has ${srcBal}`);
					continue;
				}
				val.totalAmountUbtsg -= amtNum;
				updateDelegatorBalance(val, delegatorAddress, srcBal - amtNum, millionFactor);
				console.log(`(Sim) Undelegate: ${amtNum} ubtsg from ${validatorAddress} for delegator=${delegAddr}`);
			}
			else if (msg.typeUrl === '/cosmos.staking.v1beta1.MsgDelegate')
			{
				const { delegatorAddress, validatorAddress, amount } = msg.value;
				const amtNum = Number(amount.amount);
				
				if (amount.denom !== denom)
				{
					console.warn(`MsgDelegate: denom=${amount.denom}, expected=${denom}`);
				}
				const val = valMap.get(validatorAddress);
				if (!val)
				{
					console.warn(`Invalid delegate: val=${validatorAddress}`);
					continue;
				}
				const curLiquid = liquidBalanceByDelegator[delegatorAddress] || 0;
				if (curLiquid < amtNum)
				{
					console.warn(
						`MsgDelegate: delegator ${delegatorAddress} wants to stake ${amtNum}, but only has ${curLiquid} in liquidBalance`
					);
				}
				else
				{
					// Deduct from liquidBalanceByDelegator
					liquidBalanceByDelegator[delegatorAddress] = curLiquid - amtNum;
					// Update totalAmountUbtsg
					val.totalAmountUbtsg += amtNum;
					const cur = getDelegatorBalance(val, delegatorAddress);
					updateDelegatorBalance(val, delegatorAddress, cur + amtNum, millionFactor);
					console.log(`(Sim) Delegate: ${amtNum} ubtsg to ${validatorAddress} for delegator=${delegatorAddress}`);
				}
			}
			else
			{
				console.warn('Unknown message typeUrl');
			}
		}
	}
	
	// Rebuild the output
	return enriched.map((v) =>
	{
		const newTotal = v.totalAmountUbtsg / millionFactor;
		const updatedDelegators = v.delegators.map((d) => ({
			address: d.address,
			amount: d.amountUbtsg / millionFactor,
			rewards: d.rewards,
		}));
		
		return {
			...v,
			total_amount: newTotal,
			delegators: updatedDelegators,
		};
	});
}

/**
 * Compare final_amount vs new_delegations
 * @param finalValidators ValidatorsInfo[]
 * @returns void
 **/
function checkFinalBalances(finalValidators: ValidatorInfo[])
{
	let allGood = true;
	
	// Colors
	const color_green = '\x1b[32m';
	const color_red = '\x1b[31m';
	const color_reset = '\x1b[0m';
	
	// Check each validator
	for (const val of finalValidators)
	{
		const { address, name, new_delegations, total_amount } = val;
		const delta = new_delegations - total_amount;
		
		// Allow a small difference of 0.000001
		if (Math.abs(delta) <= 1e-6)
		{
			console.log(`${color_green}OK - Validator ${address} (${name}): final=${total_amount} ~ new_delegations=${new_delegations}${color_reset}`);
		}
		else
		{
			console.warn(`${color_red}Mismatch - Validator ${address} (${name}): final=${total_amount} != new_delegations=${new_delegations} (delta=${delta})${color_reset}`);
			allGood = false;
		}
	}
	
	if (allGood)
	{
		console.log(`\n${color_green}Result: All validators match their new_delegations amounts.${color_reset}`);
	}
	else
	{
		console.warn(`\n${color_red}Result: Some validators do not match the expected new_delegations. Check warnings above.${color_reset}`);
	}
}

/**
 * Get the delegator balance
 * @param valInfo ValidatorInfo
 * @param delegatorAddress string
 * @returns number
 */
function getDelegatorBalance(valInfo: any, delegatorAddress: string): number
{
	const found = valInfo.delegators.find((x: any) => x.address === delegatorAddress);
	return found ? found.amountUbtsg : 0;
}

/**
 * Update the delegator balance
 * @param valInfo ValidatorInfo
 * @param delegatorAddress string
 * @param newBalance number
 * @returns void
 */
function updateDelegatorBalance(
	valInfo: any,
	delegatorAddress: string,
	newBalance: number,
	millionFactor = 1_000_000
)
{
	let d = valInfo.delegators.find((x: any) => x.address === delegatorAddress);
	if (!d)
	{
		// Create entry if > 0
		if (newBalance > 0)
		{
			d = {
				address: delegatorAddress,
				amount: newBalance / millionFactor,
				amountUbtsg: newBalance,
			} as any;
			valInfo.delegators.push(d);
		}
		return;
	}
	d.amountUbtsg = newBalance;
}