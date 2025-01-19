import fs from 'fs';
import path from 'path';
import {
	ValidatorInfo,
	MsgAnyStaking,
	MsgWithdraw,
	MsgDelegate,
	MsgRedelegate,
	MsgUndelegate,
} from '@/types/bitsong';

export async function generateTx()
{
	// 1) Read the allocations file
	const dataPath = path.resolve(__dirname, '../../data/allocations.json');
	const rawData = fs.readFileSync(dataPath, 'utf-8');
	const allocations = JSON.parse(rawData);
	
	// 2) Retrieve the list of validators
	const validators = allocations.delegations as ValidatorInfo[];
	
	// 3) Generate two blocks of messages
	const denom = 'ubtsg';
	const millionFactor = 1_000_000;
	
	// a) Calculate the total amounts for each category
	const sumCurrent = validators.reduce((acc, v) => acc + v.total_amount, 0);
	const sumRewards = validators.reduce(
		(acc, v) => acc + v.delegators.reduce((dacc, d) => dacc + (d.rewards ?? 0), 0),
		0
	);
	const sumTarget = validators.reduce((acc, v) => acc + v.new_delegations, 0);
	// Show the totals in the console for information before generating the messages
	console.log(`sumCurrent=${sumCurrent}, sumRewards=${sumRewards}, sumTarget=${sumTarget}`);
	
	// b) Withdraw block (withdraw rewards if >= 1 BTSG)
	const withdrawMsgsByDelegator = buildWithdrawRewardsMsgs(validators, 1);
	
	// c) Staking block (redelegate / undelegate / delegate from rewards)
	const stakingMsgsByDelegator = createRebalancingMessages(validators, denom, millionFactor, 1);
	
	// 4) Save as JSON in data/messages.json
	const outputPath = path.resolve(__dirname, '../../data/messages.json');
	const finalContent = {
		withdraw: withdrawMsgsByDelegator,
		staking: stakingMsgsByDelegator,
	};
	
	fs.writeFileSync(outputPath, JSON.stringify(finalContent, null, 2), 'utf-8');
	console.log(`Generated messages written to: ${outputPath}`);
}

/**
 * Generates MsgWithdrawDelegatorReward messages for each
 * (validator, delegator) whose rewards >= thresholdBtsg.
 * Grouped by delegator address (as for Authz).
 */
function buildWithdrawRewardsMsgs(
	validators: ValidatorInfo[],
	thresholdBtsg: number
): Record<string, MsgWithdraw[]>
{
	const msgsByDelegator: Record<string, MsgWithdraw[]> = {};
	
	// For each validator
	for (const val of validators)
	{
		// For each delegator
		for (const deleg of val.delegators)
		{
			// Check if we have >= 1 BTSG of rewards
			if (deleg.rewards && deleg.rewards >= thresholdBtsg)
			{
				// Create MsgWithdraw
				const msg: MsgWithdraw = {
					typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
					value: {
						delegatorAddress: deleg.address,
						validatorAddress: val.address,
					},
				};
				
				// Create the array if it doesn't exist
				if (!msgsByDelegator[deleg.address])
					msgsByDelegator[deleg.address] = [];
				// Add the message
				msgsByDelegator[deleg.address].push(msg);
			}
		}
	}
	
	// Return the map of Withdraw messages
	return msgsByDelegator;
}

/**
 * Generates MsgRedelegate, MsgUndelegate, and finally MsgDelegate (from rewards)
 * to achieve new_delegations.
 * @param validators ValidatorInfo[]
 * @param denom string
 * @param millionFactor number
 * @param rewardThresholdBtsg number
 * @returns Record<string, MsgAnyStaking[]> the key is delegatorAddress
 */
function createRebalancingMessages(
	validators: ValidatorInfo[],
	denom: string = 'ubtsg',
	millionFactor: number = 1_000_000,
	rewardThresholdBtsg: number = 1
): Record<string, MsgAnyStaking[]>
{
	// 0) Extra: calculate the amount of "available" rewards after withdraw.
	// We assume that after executing the "withdraw messages", each delegator
	// has liquidRewards = sum(rewards >= threshold).
	// => We store this in a dictionary { delegatorAddress -> available ubtsg }.
	const liquidRewardsByDelegator: Record<string, number> = {};
	// Create an enriched copy of the validators
	const enriched = validators.map((v) =>
	{
		const totalAmountUbtsg = Math.floor(v.total_amount * millionFactor);
		const newDelegationsUbtsg = Math.floor(v.new_delegations * millionFactor);
		const delta = newDelegationsUbtsg - totalAmountUbtsg;
		
		// List of delegators
		const delegators = v.delegators.map((d) =>
		{
			// Staked amount in ubtsg
			const amountUbtsg = Math.floor(d.amount * millionFactor);
			
			// If rewards >= threshold, we assume that after withdraw, they will become "liquid"
			const rewardUbtsg = Math.floor((d.rewards ?? 0) * millionFactor);
			if (rewardUbtsg >= rewardThresholdBtsg * millionFactor)
			{
				// Add to the "wallet" of this delegator
				liquidRewardsByDelegator[d.address] = (liquidRewardsByDelegator[d.address] || 0) + rewardUbtsg;
			}
			
			return {
				...d,
				amountUbtsg,
			};
		});
		
		return {
			...v,
			totalAmountUbtsg,
			newDelegationsUbtsg,
			delta,
			delegators,
		};
	});
	
	// 1) Separate surplus vs deficit
	const surplusVals = enriched.filter((v) => v.delta < 0);
	const deficitVals = enriched.filter((v) => v.delta > 0);
	
	// 2) Sort to distribute
	// surplus: largest surplus (most negative delta) => we do a.delta - b.delta
	surplusVals.sort((a, b) => a.delta - b.delta);
	// deficit: largest deficit first
	deficitVals.sort((a, b) => b.delta - a.delta);
	
	// Final structure of messages
	const msgsByDelegator: Record<string, MsgAnyStaking[]> = {};
	
	// 3) Redelegate from surplus to deficit
	for (const surplusVal of surplusVals)
	{
		// Calculate the remaining surplus of the validator
		let surplusRemaining = Math.abs(surplusVal.delta);
		
		// Sort the delegators of surplusVal (from largest to smallest)
		surplusVal.delegators.sort((a, b) => b.amountUbtsg - a.amountUbtsg);
		// We will go through each delegator of the surplus
		for (const delegator of surplusVal.delegators)
		{
			// The surplus has been redistributed
			if (surplusRemaining <= 0)
				break;
			
			// The delegator has no more tokens to delegate
			let delegatorBalance = delegator.amountUbtsg;
			// We will go through each validator in deficit
			for (const deficitVal of deficitVals)
			{
				// We have already covered the deficit
				if (delegatorBalance <= 0)
					break;
				// There is no more deficit
				if (deficitVal.delta <= 0)
					continue;
				
				// How much we need to cover the deficit (absolute value)
				const needed = deficitVal.delta;
				
				// We take the minimum between:
				// - delegatorBalance (what this delegator can withdraw),
				// - needed (what the deficit validator needs),
				// - surplusRemaining (how much we want to withdraw from the surplus validator without going below the target)
				const reDelAmount = Math.min(delegatorBalance, needed, surplusRemaining);
				
				if (reDelAmount > 0)
				{
					// Update balances
					surplusRemaining -= reDelAmount;
					delegatorBalance -= reDelAmount;
					deficitVal.delta -= reDelAmount;
					
					// Create MsgRedelegate
					const msg: MsgRedelegate = {
						typeUrl: '/cosmos.staking.v1beta1.MsgRedelegate',
						value: {
							delegatorAddress: delegator.address,
							validatorSrcAddress: surplusVal.address,
							validatorDstAddress: deficitVal.address,
							amount: {
								denom,
								amount: reDelAmount.toString(),
							},
						},
					};
					pushMsg(msgsByDelegator, delegator.address, msg);
				}
				
				if (surplusRemaining <= 0)
				{
					break;
				}
			}
			
			// Update the staked balance for this delegator
			delegator.amountUbtsg = delegatorBalance;
		}
		
		// If we still have a surplus in delegation, we need to Undelegate the tokens
		// this is the excess that could not be redistributed to validators in deficit
		if (surplusRemaining > 0)
		{
			let stillToUndelegate = surplusRemaining;
			
			// We will withdraw the remaining amount from delegators
			for (const delegator of surplusVal.delegators)
			{
				// We have withdrawn enough
				if (stillToUndelegate <= 0)
					break;
				// There is nothing left to withdraw
				if (delegator.amountUbtsg <= 0)
					continue;
				
				const undelegateAmount = Math.min(delegator.amountUbtsg, stillToUndelegate);
				// If we still have something to withdraw
				if (undelegateAmount > 0)
				{
					stillToUndelegate -= undelegateAmount;
					delegator.amountUbtsg -= undelegateAmount;
					
					// Create MsgUndelegate
					const msg: MsgUndelegate = {
						typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
						value: {
							delegatorAddress: delegator.address,
							validatorAddress: surplusVal.address,
							amount: {
								denom,
								amount: undelegateAmount.toString(),
							},
						},
					};
					pushMsg(msgsByDelegator, delegator.address, msg);
				}
			}
		}
	}
	
	// 4) At this stage, we have redistributed everything possible via re-delegation.
	//    There may still be validators in deficit -> we try to pick
	//    from liquidRewardsByDelegator via MsgDelegate
	
	// Re-sort remaining deficits
	const stillDeficit = deficitVals.filter((v) => v.delta > 0);
	stillDeficit.sort((a, b) => b.delta - a.delta);
	
	if (stillDeficit.length > 0)
	{
		// We will go through each validator in deficit
		for (const defVal of stillDeficit)
		{
			let needed = defVal.delta;
			if (needed <= 0)
				continue;
			
			// Pick from the "wallet" of delegators (who have liquidRewards) starting with the "largest wallet" first
			const delegatorList = Object.entries(liquidRewardsByDelegator)
				.filter(([_, bal]) => bal > 0)
				.sort((a, b) => b[1] - a[1]); // descending sort by balance
			
			for (const [delegAddr, liquidBal] of delegatorList)
			{
				if (needed <= 0) break;
				if (liquidBal <= 0) continue;
				
				const delegateAmount = Math.min(liquidBal, needed);
				if (delegateAmount > 0)
				{
					// Create MsgDelegate
					const msg: MsgDelegate = {
						typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
						value: {
							delegatorAddress: delegAddr,
							validatorAddress: defVal.address,
							amount: {
								denom,
								amount: delegateAmount.toString(),
							},
						},
					};
					pushMsg(msgsByDelegator, delegAddr, msg);
					
					// Update the delegator's "liquid" balance
					liquidRewardsByDelegator[delegAddr] -= delegateAmount;
					
					// Reduce the needed amount
					needed -= delegateAmount;
				}
			}
		}
	}
	
	return msgsByDelegator;
}

/**
 * Helper to add a message to the array of an address in msgsByDelegator
 * @param msgsByDelegator Record<string, MsgAnyStaking[]>
 * @param delegatorAddress string
 * @param msg MsgAnyStaking
 */
function pushMsg(
	msgsByDelegator: Record<string, MsgAnyStaking[]>,
	delegatorAddress: string,
	msg: MsgAnyStaking
)
{
	if (!msgsByDelegator[delegatorAddress])
	{
		msgsByDelegator[delegatorAddress] = [];
	}
	msgsByDelegator[delegatorAddress].push(msg);
}
