// @flow

import bs58 from 'bs58';

import {
  Account,
  Connection,
  BpfLoader,
  BPF_LOADER_DEPRECATED_PROGRAM_ID,
  BPF_LOADER_PROGRAM_ID,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
} from '@solana/web3.js';
import { Token, MintLayout, AccountLayout } from "@solana/spl-token";

let TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

let TREASURY_TOKEN_PRECISION = 9;

import fs from 'mz/fs';
import * as BufferLayout from 'buffer-layout';

import {url, urlTls} from '../url';
import {Store} from './util/store';

import {sleep} from './util/sleep';
import {newAccountWithLamports} from './util/new-account-with-lamports';
import {sendAndConfirmTransaction} from './util/send-and-confirm-transaction';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Accounts
 */
let programAccount: Account;
let payerAccount: Account;

/**
 * Secret Keys
 */
let programSecretKey;
let payerSecretKey;


/**
 * Public Keys
 */
let programId: PublicKey;
let auctionListPubkey: PublicKey;

const pathToProgram = 'dist/program/sixtyfourgame.so';

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  connection = new Connection(url, 'recent');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', url, version);
}

function createSplAccount(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  accountRentExempt: number,
  mint: PublicKey,
  owner: PublicKey,
  space: number
) {
  const account = new Account();
  instructions.push(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: accountRentExempt,
      space,
      programId: TOKEN_PROGRAM_ID,
    })
  );
  instructions.push(
    Token.createInitAccountInstruction(
      TOKEN_PROGRAM_ID,
      mint,
      account.publicKey,
      owner
    )
  );
  return account;
}

async function loadStore() {
    const store = new Store();
    let auctionListPubkey;
    let treasuryPubkey;
    try {
      let config = await store.load('config.json');
      if (config.programId !== "") {
          programId = new PublicKey(config.programId);
      }
      if (config.auctionListPubkey !== "") {
          auctionListPubkey = new PublicKey(config.auctionListPubkey);
      }
      if (config.treasuryPubkey !== "") {
          treasuryPubkey = new PublicKey(config.treasuryPubkey);
      }
      payerSecretKey = config.payerSecretKey;
      payerAccount = new Account(Buffer.from(payerSecretKey, "base64"));
    } catch (err) {
      console.log(err);
    }
    return [store, programId, payerAccount, auctionListPubkey, treasuryPubkey];
}

async function saveStore(store, urlTls, programId, payerSecretKey, auctionListPubkey, treasuryPubkey) {
    try {
      await store.save('config.json', {
        url: urlTls,
        programId: typeof programId !== 'undefined' ? programId.toBase58() : '',
        auctionListPubkey: typeof auctionListPubkey !== 'undefined' ? auctionListPubkey.toBase58() : '',
        treasuryPubkey: typeof treasuryPubkey !== 'undefined' ? treasuryPubkey.toBase58() : '',
        payerSecretKey: payerSecretKey,
      });
    } catch (err) {
      console.log(err);
    }
}

/**
 * Establish an account that owns every account deployed
 */
export async function establishOwner(): Promise<void> {
  let [store, programId, payerAccount, auctionListPubkey, treasuryPubkey] = await loadStore();

  if (!payerAccount) {
    let fees = 0;
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to load the program
    const data = await fs.readFile(pathToProgram);
    fees += await connection.getMinimumBalanceForRentExemption(data.length);

    // Fund a new payer via airdrop
    payerAccount = await newAccountWithLamports(connection, fees);
    payerSecretKey = Buffer.from(payerAccount.secretKey).toString("base64");
  } else {
    console.log("Payer account loaded");
  }

  const lamports = await connection.getBalance(payerAccount.publicKey);
  console.log(
    'Using account',
    payerAccount.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'Sol to pay for fees',
  );

  await sleep(1000);

  await saveStore(
    store,
    urlTls,
    programId,
    payerSecretKey,
    auctionListPubkey,
    treasuryPubkey,
  );
}

/**
 * Load the hello world BPF program if not already loaded
 */
export async function loadProgram(): Promise<void> {

  let [store, programId, payerAccount, auctionListPubkey, treasuryPubkey] = await loadStore();
  let loaded = false;
  if (typeof programId !== 'undefined') {
    await connection.getAccountInfo(programId);
    console.log('Program already loaded to account ' + programId.toBase58());
    loaded = true;
  }

  if (!loaded) {
      // Load the program
      console.log('Loading sixtyfourgame program...');
      const data = await fs.readFile(pathToProgram);
      programAccount = new Account();

      console.log(payerAccount.publicKey.toBase58());
      console.log(programAccount.publicKey.toBase58());
      try {
          await BpfLoader.load(
              connection,
              payerAccount,
              programAccount,
              data,
              BPF_LOADER_PROGRAM_ID,
          );
      } catch (err) {
          console.log(err);
      }
      programId = programAccount.publicKey;
      console.log('Program loaded to', programId.toBase58());
      let programAccountSecretKey = Buffer.from(programAccount.secretKey).toString("base64");
      console.log('programAccountSecretKey ', programAccountSecretKey);
  }

  if (auctionListPubkey == "") {
      // Create the auctionList account
      const auctionListAccount = new Account();
      auctionListPubkey = auctionListAccount.publicKey;
      console.log('Creating Auction List with address ', auctionListPubkey.toBase58(), ' for the game');

      let auctionListAccountSecretKey = Buffer.from(auctionListAccount.secretKey).toString("base64");
      console.log('auctionListAccountSecretKey   ', auctionListAccountSecretKey);

      // Account needs data for 64 pubkeys plus 64 lamport amounts in u64
      let space = (1 * 32) + (1 * 8);
      console.log('Auction List using ', space.toString(), ' allocated bytes');

      // Get rent exempt amount of lamports
      const lamports =  await connection.getMinimumBalanceForRentExemption(space);
      console.log('Rent-exempt lamports for auction list: ',lamports.toString());

      // Create Auction List
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: payerAccount.publicKey,
          newAccountPubkey: auctionListPubkey,
          lamports,
          space,
          programId,
        }),
      );
      await sendAndConfirmTransaction(
        'createAccount',
        connection,
        transaction,
        payerAccount,
        auctionListAccount,
      );
  }
  console.log("Auction List address: " + auctionListPubkey.toBase58());

  if (typeof treasuryPubkey == "undefined" || treasuryPubkey == "") {
      // Create the auctionList account
      const treasuryAccount = new Account();
      treasuryPubkey = treasuryAccount.publicKey;
      console.log('Creating Treasury with address ', treasuryPubkey.toBase58(), ' for the game');

      let treasuryAccountSecretKey = Buffer.from(treasuryAccount.secretKey).toString("base64");
      console.log('treasuryAccountSecretKey   ', treasuryAccountSecretKey);

      // Account needs no data
      let space = 0;
      console.log('Treasury using ', space.toString(), ' allocated bytes');

      // Get rent exempt amount of lamports
      const lamports =  await connection.getMinimumBalanceForRentExemption(space);
      console.log('Rent-exempt lamports for Treasury: ',lamports.toString());

      // Create Auction List
      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: payerAccount.publicKey,
          newAccountPubkey: treasuryPubkey,
          lamports,
          space,
          programId,
        }),
      );
      await sendAndConfirmTransaction(
        'createAccount',
        connection,
        transaction,
        payerAccount,
        treasuryAccount,
      );
  }
  console.log("Treasury address: " + treasuryPubkey.toBase58());

  await saveStore(
    store,
    urlTls,
    programId,
    payerSecretKey,
    auctionListPubkey,
    treasuryPubkey,
  );
}

function longToByteArray(/*long*/long) {
    // we want to represent the input as a 8-bytes array
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];

    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = long & 0xff;
        byteArray [ index ] = byte;
        long = (long - byte) / 256 ;
    }

    return byteArray;
};
