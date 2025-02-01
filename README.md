Bitsong DAO Distribution

## Project Overview

This project aims to rebalance BTSG token delegations across multiple validators, taking into account the delegation targets (new_delegations) for each. It then generates two sets of messages (withdraw and staking) to perform:

- The withdrawal of accumulated rewards (`MsgWithdrawDelegatorReward`),
- The re-delegation (`MsgBeginRedelegate`), delegation from rewards (`MsgDelegate`), and undelegation of surplus (`MsgUndelegate`).

For more details, visit the DAO page [here](https://daodao.zone/dao/bitsong1qfwdjcmxgjr9jwa2grhf7pce87afx57j2664tvhh29j7r68a9tgqj9kuf3/home).

## Prerequisites

- Node.js version 22 or higher,
- npm (or another package manager) to install your dependencies.

To install the project dependencies:

```bash
npm install
```

## Files and Structure

The project structure is as follows:

```
src/
	commands/
		generateTx.ts
		testTx.ts
	types/
		bitsong.ts
	main.ts
data/
	allocations.json
	messages.json (generated)
```

- `data/allocations.json`: Main file containing the initial configuration, generated using the bitsongofficial/delegation-dao project.
	- It contains the current information of the validators (total_amount, delegators, etc.), as well as the final target (new_delegations).
- `data/messages.json`: File generated by the `generateTx` command, in which we store:
	- The withdraw messages (to withdraw rewards),
	- The staking messages (to re-delegate, delegate rewards, and undelegate surplus).

## General Concept

### Allocations

The `allocations.json` file lists each validator, with:

- `address`: bitsongvaloper...
- `name`: validator name
- `status`: validator status
- `total_amount`: current delegation
- `total_rewards`: accumulated rewards
- `delegators`: addresses that have delegated, with their amounts and rewards
- `new_delegations`: final target

### Objective

- If a validator has more tokens than its target (surplus), the excess is transferred via `MsgBeginRedelegate` or `MsgUndelegate`.
- If a validator is below its target, we try to recover tokens either from validators with a surplus or from unclaimed rewards (`MsgDelegate` after a withdraw).

### Commands

- `generateTx`:
	- Reads `allocations.json`,
	- Constructs the “withdraw” and “staking” messages (redelegate, delegate, undelegate),
	- Writes them to `messages.json`.
- `testTx`:
	- Reloads `allocations.json` and `messages.json`,
	- Locally simulates the operations to verify that the desired new_delegations are achieved (or approached),
	- Displays a final report (OK / Mismatch).

## Usage

### Generating Transactions

To generate the message files:

```bash
npx tsx src/main.ts generateTx
```

This command:

- Analyzes `allocations.json` and calculates the necessary transactions
- Produces a `messages.json` file with the necessary transactions
- Logs the current sum, the rewards sum, and the target sum to the console
- As well as any warnings about validators remaining in deficit.

The `generateTx` command accepts two options:

- `--outputExcel`: Output the result in an Excel file.
- `--ignoreRewards`: Ignore pending rewards in the transaction.

Example usage with options:

```bash
npx tsx src/main.ts generateTx --outputExcel --ignoreRewards
```

### Testing the Distribution

To test the result (without actually executing the transaction on the blockchain):

```bash
npx tsx src/main.ts testTx
```

This command:

- Loads `allocations.json` and `messages.json`,
- Simulates the `MsgWithdrawDelegatorReward`, then the `MsgBeginRedelegate`, `MsgUndelegate`, `MsgDelegate`,
- Checks if each validator reaches its target (new_delegations),
- Displays “OK” or “Mismatch” messages based on the final discrepancy.

### Generating Authz Transactions

To generate separate authorization transactions for withdrawal and staking:

```bash
npx tsx src/main.ts generateAuthzTx
```

This command:

- Reads `allocations.json`,
- Constructs separate authorization transactions for withdrawal and staking,
- Writes the transactions to `tx-1.json` and `tx-2.json`.

Example usage:

```bash
npx tsx src/main.ts generateAuthzTx
```

## License

This project is licensed under the GPL v3 License - see the LICENSE file for details.
