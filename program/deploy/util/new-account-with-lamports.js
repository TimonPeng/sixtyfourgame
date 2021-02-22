// @flow

import {Account, Connection} from '@solana/web3.js';

import {sleep} from './sleep';

export async function newAccountWithLamports(
  connection: Connection,
  lamports: number = 1000000,
): Promise<Account> {
  const account = new Account();

  console.log('trying to airdrop ' + lamports);

  let lamport_amount_single_ad = 9900000000;
  let max_tries = 1;
  if (lamports > lamport_amount_single_ad) {
      max_tries = Math.ceil(lamports / lamport_amount_single_ad);
  }

  console.log('max tries ' + max_tries);

  let retries = 100;
  for (;;) {
    try {
        await connection.requestAirdrop(account.publicKey, lamport_amount_single_ad);
    } catch(e) {
        console.log(e);
    }

    await sleep(1000);
    if (lamport_amount_single_ad * max_tries <= (await connection.getBalance(account.publicKey))) {
      return account;
    }
    if (--retries <= 0) {
      break;
    }
    console.log('Airdrop retry ' + retries);
  }

  throw new Error(`Airdrop of ${lamports} failed`);
}
