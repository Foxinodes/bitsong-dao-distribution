import fs from 'fs';
import path from 'path';
import {
	MessagesFile,
} from '@/types/bitsong';

export async function generateGrantTx(granteeAddress: string): Promise<void>
{
	// 1) Load messages.json
	const messagesPath = path.resolve(__dirname, '../../data/messages.json');
	const raw = fs.readFileSync(messagesPath, 'utf-8');
	const messages: MessagesFile = JSON.parse(raw);
	
	// Calculate the expiration date: current time + 1 year
	const currentTimestamp = Math.floor(Date.now() / 1000);
	const oneYearInSeconds = 365 * 24 * 60 * 60;
	const expirationTimestamp = currentTimestamp + oneYearInSeconds;
	
	// 2) Extract delegator addresses from messages.withdraw
	const delegators = Object.keys(messages.withdraw);
	
	// 3) Define the permissions to be granted via grant messages
	const permissions = [
		'/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
		'/cosmos.staking.v1beta1.MsgDelegate',
		'/cosmos.staking.v1beta1.MsgBeginRedelegate',
		'/cosmos.staking.v1beta1.MsgUndelegate'
	];
	
	// 4) For each delegator, build and write the JSON file containing the grant messages
	delegators.forEach((delegatorAddress) =>
	{
		const grantMessages = permissions.map((permission) => ({
			typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
			value: {
				granter: delegatorAddress, // The delegator granting the permission
				grantee: granteeAddress, // The authorized address passed as a parameter
				grant: {
					authorization: {
						typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
						value: {
							msg: permission
						}
					},
					expiration: {
						seconds: expirationTimestamp, // Dynamic expiration date (current time + 1 year)
						nanos: 0
					}
				}
			}
		}));
		
		const filePath = path.resolve(__dirname, `../../data/grant-${delegatorAddress}.json`);
		fs.writeFileSync(filePath, JSON.stringify(grantMessages, null, 2), 'utf-8');
		console.log(`Grant Authz TX written to: ${filePath}`);
	});
}
