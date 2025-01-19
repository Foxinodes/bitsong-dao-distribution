
export interface ValidatorInfo
{
	address: string; // bitsongvaloper...
	name: string;
	total_amount: number; // BTSG
	total_rewards: number; // BTSG
	new_delegations: number; // BTSG
	delegators: {
		address: string; // bitsong1...
		amount: number; // BTSG
		rewards: number; // BTSG
	}[];
}

export interface MsgWithdraw
{
	typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward';
	value: {
		delegatorAddress: string;
		validatorAddress: string;
	};
}

export interface MsgDelegate
{
	typeUrl: '/cosmos.staking.v1beta1.MsgDelegate';
	value: {
		delegatorAddress: string;
		validatorAddress: string;
		amount: {
		denom: string;
		amount: string;
		};
	};
}

export interface MsgRedelegate
{
	typeUrl: '/cosmos.staking.v1beta1.MsgRedelegate';
	value: {
		delegatorAddress: string;
		validatorSrcAddress: string;
		validatorDstAddress: string;
		amount: {
		denom: string;
		amount: string;
		};
	};
}

export interface MsgUndelegate
{
	typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate';
	value: {
		delegatorAddress: string;
		validatorAddress: string;
		amount: {
		denom: string;
		amount: string;
		};
	};
}

export type MsgAnyStaking = MsgDelegate | MsgRedelegate | MsgUndelegate;
export type MsgAny = MsgWithdraw| MsgRedelegate| MsgUndelegate| MsgDelegate;
