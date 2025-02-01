
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

export interface MsgBeginRedelegate
{
	typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate';
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

export interface MsgExec
{
	typeUrl: '/cosmos.authz.v1beta1.MsgExec';
	value: {
		grantee: string;
		msgs: MsgAny[];
	};
}

export interface DaodaoAction
{
	actionKey: string;
	data: any;
}

export type MsgAnyStaking = MsgDelegate | MsgBeginRedelegate | MsgUndelegate;
export type MsgAny = MsgWithdraw | MsgBeginRedelegate | MsgUndelegate | MsgDelegate | MsgExec;
