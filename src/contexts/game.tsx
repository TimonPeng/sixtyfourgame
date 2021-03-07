
import {
  BpfLoader,
  BPF_LOADER_DEPRECATED_PROGRAM_ID,
  PublicKey,
  LAMPORTS_PER_SOL,
  Account,
  AccountInfo,
  clusterApiUrl,
  Commitment,
  Connection,
  Transaction,
  TransactionSignature,
  SystemProgram,
  TransactionInstruction,
  RpcResponseAndContext,
  SimulatedTransactionResponse,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {
  DexInstructions,
  Market,
  OpenOrders,
  TOKEN_MINTS,
  TokenInstructions,
} from '@project-serum/serum';
import {AccountLayout, u64, MintInfo, MintLayout, Token} from "@solana/spl-token";
import React, { useContext, useEffect, useMemo } from "react";
import { notify } from "../utils/notifications";
import { WalletAdapter } from "./wallet";
import BN from 'bn.js';
import { sleep } from '../utils/utils';

const DEFAULT_TIMEOUT = 15000;

let TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
let sysvarSlotHashesPubKey = new PublicKey('SysvarS1otHashes111111111111111111111111111');
let quoteTokenMintSOL = new PublicKey('So11111111111111111111111111111111111111112');

let serumDexProgramIdDevnet = new PublicKey('FG4zpk8FPP3R9K7JYZmgeUKCe6qMAsHgTncnMHJYJrxB');
// let serumDexProgramIdDevnet = new PublicKey('9MVDeYQnJmN2Dt7H44Z8cob4bET2ysdNu2uFJcatDJno');

export const getUnixTs = () => {
  return new Date().getTime() / 1000;
};

// TODO: move to util
const longToByteArray = function(long: any) {
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = long & 0xff;
        byteArray [ index ] = byte;
        long = (long - byte) / 256 ;
    }
    return byteArray;
};

function byteArrayToLong(byteArray: any) {
    var value = 0;
    for ( var i = byteArray.length - 1; i >= 0; i--) {
        value = (value * 256) + byteArray[i];
    }
    return value;
};

export const sendBidSequence = async (
  amount: any,
  wallet: any,
  connection: any,
  programId: PublicKey,
  auctionListPubkey: PublicKey,
  treasuryPubkey: PublicKey,
  auctionEndSlotPubkey: PublicKey,
  sysvarClockPubKey: PublicKey,
) => {

    // Create new game fund account
    let transaction = new Transaction();
    let treasuryFundAccount = new Account();
    let treasuryFundAccountPubKey = treasuryFundAccount.publicKey;
    let lamports = 100000;
    let space = 0;
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: treasuryFundAccountPubKey,
            lamports,
            space,
            programId,
        })
    );

    // Send bid funds
    transaction.add(SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: treasuryFundAccount.publicKey,
        lamports: amount * LAMPORTS_PER_SOL,
    }));

    // Create new bid transaction
    const instruction = new TransactionInstruction({
        keys: [{pubkey: wallet.publicKey, isSigner: true, isWritable: true},
               {pubkey: auctionListPubkey, isSigner: false, isWritable: true},
               {pubkey: treasuryFundAccountPubKey, isSigner: true, isWritable: true},
               {pubkey: treasuryPubkey, isSigner: false, isWritable: true},
               {pubkey: auctionEndSlotPubkey, isSigner: false, isWritable: true},
               {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false}],
        programId,
        data: Buffer.from([1, ...longToByteArray(amount * LAMPORTS_PER_SOL)]),
    });
    transaction.add(instruction);

    console.log('Sending Bid transaction');
    let txid = await sendTransaction(connection, wallet, treasuryFundAccount, null, transaction, true);
    console.log('Bid transaction sent');

    notify({
      message: "Bid transaction sent",
      type: "success",
      txid: txid
    });
};

export const sendClaimSequence = async (
  wallet: any,
  connection: any,
  programId: PublicKey,
  bidEntryPubkey: PublicKey,
  auctionListPubkey: PublicKey,
  auctionEndSlotPubkey: PublicKey,
  sysvarClockPubKey: PublicKey,
  splTokenProgramPubKey: PublicKey,
  allGameSquaresListPubkey: PublicKey,
  treasuryPubkey: PublicKey,
) => {

    // Create new game fund account
    let transaction = new Transaction();

    let space = MintLayout.span;
    let lamports = await connection.getMinimumBalanceForRentExemption(
      MintLayout.span
    );
    const mintAccount = new Account();
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: mintAccount.publicKey,
            lamports,
            space,
            programId: TOKEN_PROGRAM_ID,
        })
    );

    space = 165;
    lamports = await connection.getMinimumBalanceForRentExemption(space);
    const tokenAccount = new Account();
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: tokenAccount.publicKey,
            lamports,
            space,
            programId: TOKEN_PROGRAM_ID,
        })
    );

    const [mint_pda, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("mint")],
      programId,
    );

    // Create new claim transaction
    const instruction = new TransactionInstruction({
        keys: [{pubkey: wallet.publicKey, isSigner: true, isWritable: true},
               {pubkey: bidEntryPubkey, isSigner: false, isWritable: true},
               {pubkey: auctionListPubkey, isSigner: false, isWritable: true},
               {pubkey: auctionEndSlotPubkey, isSigner: false, isWritable: true},
               {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
               {pubkey: mintAccount.publicKey, isSigner: true, isWritable: true},
               {pubkey: tokenAccount.publicKey, isSigner: true, isWritable: true},
               {pubkey: mint_pda, isSigner: false, isWritable: false},
               {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
               {pubkey: splTokenProgramPubKey, isSigner: false, isWritable: false},
               {pubkey: allGameSquaresListPubkey, isSigner: false, isWritable: true},
               {pubkey: treasuryPubkey, isSigner: false, isWritable: true}],
        data: Buffer.from([3]),
        programId,
    });
    transaction.add(instruction);

    console.log('Sending Claim transaction');
    let txid = await sendTransaction(connection, wallet, mintAccount, tokenAccount, transaction, true);
    console.log('Claim transaction sent');

    notify({
      message: "Resolve transaction sent",
      type: "success",
      txid: txid
    });
};

export const getGameSquareTokenAccount = async (
  connection: any,
  mint: any
) => {
    try {
        const accounts = await connection.getTokenLargestAccounts(mint);
        if (accounts) {
            for(var i = 0;i<accounts.value.length;i++) {
                if (accounts.value[i].amount == 1) {
                    return accounts.value[i].address;
                }
            }
        }
    } catch (e) {
        console.log(e);
    }
    return;
};

export const getAllTokenAccounts = async (
  connection: any,
  wallet: any,
) => {
    var tokenAccounts:any[] = new Array(0);
    try {
        const accounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {programId: TOKEN_PROGRAM_ID});
        tokenAccounts = accounts.value;
    } catch (e) {
        console.log(e);
    }
    return tokenAccounts;
};

export const sendInitiatePlaySequence = async (
  wallet: any,
  gameSquareNumber: number,
  connection: any,
  programId: PublicKey,
  gameSquareTokenAccountPubkey: PublicKey,
  auctionInfoPubkey: PublicKey,
  sysvarClockPubKey: PublicKey,
  gameSquareMintPubkey: PublicKey,
  splTokenProgramPubKey: PublicKey,
  activePlayersListPubkey: PublicKey,
  treasuryPubkey: PublicKey,
) => {

    // Create Token Account for program
    let transaction = new Transaction();
    let space = 165;
    let lamports = await connection.getMinimumBalanceForRentExemption(space);
    const programTokenAccount = new Account();
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: programTokenAccount.publicKey,
            lamports,
            space,
            programId: TOKEN_PROGRAM_ID,
        })
    );

    const [programTokenAccountPda, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("initiate")],
      programId,
    );

    // Create new initiate play transaction
    const instruction = new TransactionInstruction({
        keys: [{pubkey: wallet.publicKey, isSigner: true, isWritable: true},
               {pubkey: gameSquareTokenAccountPubkey, isSigner: false, isWritable: true},
               {pubkey: auctionInfoPubkey, isSigner: false, isWritable: true},
               {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
               {pubkey: gameSquareMintPubkey, isSigner: false, isWritable: true},
               {pubkey: programTokenAccountPda, isSigner: false, isWritable: true},
               {pubkey: programTokenAccount.publicKey, isSigner: true, isWritable: true},
               {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
               {pubkey: splTokenProgramPubKey, isSigner: false, isWritable: false},
               {pubkey: activePlayersListPubkey, isSigner: false, isWritable: true},
               {pubkey: treasuryPubkey, isSigner: false, isWritable: true}],
        data: Buffer.from([4, ...longToByteArray(gameSquareNumber)]),
        programId,
    });
    transaction.add(instruction);

    console.log('Sending Initiate Play transaction');
    let txid = await sendTransaction(connection, wallet, programTokenAccount, null, transaction, true);
    console.log('Initiate Play transaction sent');

    notify({
      message: "Activate transaction sent",
      type: "success",
      txid: txid
    });
};

export const sendEndPlaySequence = async (
  wallet: any,
  gameSquareNumber: number,
  connection: any,
  programId: PublicKey,
  gameSquareTokenAccountPubkey: PublicKey,
  auctionInfoPubkey: PublicKey,
  sysvarClockPubKey: PublicKey,
  gameSquareMintPubkey: PublicKey,
  splTokenProgramPubKey: PublicKey,
  activePlayersListPubkey: PublicKey,
  treasuryPubkey: PublicKey,
) => {

    // Create Token Account for user
    let transaction = new Transaction();
    let space = 165;
    let lamports = await connection.getMinimumBalanceForRentExemption(space);
    const userTokenAccount = new Account();
    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: userTokenAccount.publicKey,
            lamports,
            space,
            programId: TOKEN_PROGRAM_ID,
        })
    );

    const [programTokenAccountPda, bump] = await PublicKey.findProgramAddress(
      [Buffer.from("initiate")],
      programId,
    );

    // Create new initiate play transaction
    const instruction = new TransactionInstruction({
        keys: [{pubkey: wallet.publicKey, isSigner: true, isWritable: true},
               {pubkey: userTokenAccount.publicKey, isSigner: false, isWritable: true},
               {pubkey: gameSquareTokenAccountPubkey, isSigner: false, isWritable: true},
               {pubkey: auctionInfoPubkey, isSigner: false, isWritable: true},
               {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
               {pubkey: gameSquareMintPubkey, isSigner: false, isWritable: true},
               {pubkey: programTokenAccountPda, isSigner: false, isWritable: true},
               {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
               {pubkey: splTokenProgramPubKey, isSigner: false, isWritable: false},
               {pubkey: activePlayersListPubkey, isSigner: false, isWritable: true},
               {pubkey: treasuryPubkey, isSigner: false, isWritable: true}],
        data: Buffer.from([5, ...longToByteArray(gameSquareNumber)]),
        programId,
    });
    transaction.add(instruction);

    console.log('Sending End Play transaction');
    let txid = await sendTransaction(connection, wallet, userTokenAccount, null, transaction, true);
    console.log('End Play transaction sent');

    notify({
      message: "Retreat transaction sent",
      type: "success",
      txid: txid
    });
};

export const sendAttackSequence = async (
  wallet: any,
  attackAmount: number,
  attackGameSquareIndex: number,
  defendGameSquareNumber: number,
  connection: any,
  programId: PublicKey,
  auctionInfoPubkey: PublicKey,
  sysvarClockPubKey: PublicKey,
  splTokenProgramPubKey: PublicKey,
  activePlayersListPubkey: PublicKey,
  allGameSquaresListPubkey: PublicKey,
  treasuryPubkey: PublicKey,
) => {
    // game square index = 0-63
    // game square number = 1-64

    // Create new initiate play transaction
    let transaction = new Transaction();
    const instruction = new TransactionInstruction({
        keys: [{pubkey: wallet.publicKey, isSigner: true, isWritable: true},
               {pubkey: auctionInfoPubkey, isSigner: false, isWritable: true},
               {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
               {pubkey: sysvarSlotHashesPubKey, isSigner: false, isWritable: false},
               {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
               {pubkey: splTokenProgramPubKey, isSigner: false, isWritable: false},
               {pubkey: activePlayersListPubkey, isSigner: false, isWritable: true},
               {pubkey: allGameSquaresListPubkey, isSigner: false, isWritable: true},
               {pubkey: treasuryPubkey, isSigner: false, isWritable: true}],
        data: Buffer.from([
            6, ...longToByteArray(attackAmount),
            ...longToByteArray(attackGameSquareIndex),
            ...longToByteArray(defendGameSquareNumber - 1)
        ]),
        programId,
    });
    transaction.add(instruction);

    console.log('Sending Attack transaction');
    let txid = await sendTransaction(connection, wallet, null, null, transaction, true);
    console.log('Attack transaction sent');

    notify({
      message: "Attack transaction sent",
      type: "success",
      txid: txid
    });
};

export const sendCreateMarketSequence = async (
  wallet: any,
  baseMintAddress: PublicKey,
  connection: any,
  programId: PublicKey,
  auctionInfoPubkey: PublicKey,
  sysvarClockPubKey: PublicKey,
  splTokenProgramPubKey: PublicKey,
  activePlayersListPubkey: PublicKey,
  allGameSquaresListPubkey: PublicKey,
  treasuryPubkey: PublicKey,
) => {
    var marketAddress;
    try {
      marketAddress = await listMarket({
        connection,
        wallet,
        baseMint: baseMintAddress,
        quoteMint: quoteTokenMintSOL,
        baseLotSize: 1,
        quoteLotSize: 1000000,
        dexProgramId: serumDexProgramIdDevnet,
      });
    } catch (e) {
      console.warn(e);
      notify({
        message: "Error creating market...",
        type: "error",
      });
    }

    notify({
      message: "Create market transactions sent",
      type: "success"
    });
    
    return marketAddress;
};

export async function listMarket({
  connection,
  wallet,
  baseMint,
  quoteMint,
  baseLotSize,
  quoteLotSize,
  dexProgramId,
}: {
  connection: Connection;
  wallet: WalletAdapter;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseLotSize: number;
  quoteLotSize: number;
  dexProgramId: PublicKey;
}) {
  const market = new Account();
  const requestQueue = new Account();
  const eventQueue = new Account();
  const bids = new Account();
  const asks = new Account();
  const baseVault = new Account();
  const quoteVault = new Account();
  const feeRateBps = 0;
  const quoteDustThreshold = new BN(100);

  async function getVaultOwnerAndNonce() {
    const nonce = new BN(0);
    while (true) {
      try {
        const vaultOwner = await PublicKey.createProgramAddress(
          [market.publicKey.toBuffer(), nonce.toArrayLike(Buffer, 'le', 8)],
          dexProgramId,
        );
        return [vaultOwner, nonce];
      } catch (e) {
        nonce.iaddn(1);
      }
    }
  }
  const [vaultOwner, vaultSignerNonce] = await getVaultOwnerAndNonce();

  if (typeof wallet == "undefined" || wallet.publicKey == null) {
    throw new Error('Missing wallet');
  }

  const tx1 = new Transaction();
  tx1.add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: baseVault.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(165),
      space: 165,
      programId: TokenInstructions.TOKEN_PROGRAM_ID,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: quoteVault.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(165),
      space: 165,
      programId: TokenInstructions.TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeAccount({
      account: baseVault.publicKey,
      mint: baseMint,
      owner: vaultOwner,
    }),
    TokenInstructions.initializeAccount({
      account: quoteVault.publicKey,
      mint: quoteMint,
      owner: vaultOwner,
    }),
  );

  const tx2 = new Transaction();
  tx2.add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: market.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(
        Market.getLayout(dexProgramId).span,
      ),
      space: Market.getLayout(dexProgramId).span,
      programId: dexProgramId,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: requestQueue.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(5120 + 12),
      space: 5120 + 12,
      programId: dexProgramId,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: eventQueue.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(262144 + 12),
      space: 262144 + 12,
      programId: dexProgramId,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: bids.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
      space: 65536 + 12,
      programId: dexProgramId,
    }),
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: asks.publicKey,
      lamports: await connection.getMinimumBalanceForRentExemption(65536 + 12),
      space: 65536 + 12,
      programId: dexProgramId,
    }),
    DexInstructions.initializeMarket({
      market: market.publicKey,
      requestQueue: requestQueue.publicKey,
      eventQueue: eventQueue.publicKey,
      bids: bids.publicKey,
      asks: asks.publicKey,
      baseVault: baseVault.publicKey,
      quoteVault: quoteVault.publicKey,
      baseMint,
      quoteMint,
      baseLotSize: new BN(baseLotSize),
      quoteLotSize: new BN(quoteLotSize),
      feeRateBps,
      vaultSignerNonce,
      quoteDustThreshold,
      programId: dexProgramId,
    }),
  );

  const signedTransactions = await signTransactions({
    transactionsAndSigners: [
      { transaction: tx1, signers: [baseVault, quoteVault] },
      {
        transaction: tx2,
        signers: [market, requestQueue, eventQueue, bids, asks],
      },
    ],
    wallet,
    connection,
  });
  for (let signedTransaction of signedTransactions) {
    await sendSignedTransaction({
      signedTransaction,
      connection,
    });
  }

  return market.publicKey;
}

export const sendClaimPrizeSequence = async (
  wallet: any,
  claimSquareNumber: number,
  connection: any,
  programId: PublicKey,
  claimerAccountPubkey: PublicKey,
  auctionInfoPubkey: PublicKey,
  sysvarClockPubKey: PublicKey,
  splTokenProgramPubKey: PublicKey,
  activePlayersListPubkey: PublicKey,
  allGameSquaresListPubkey: PublicKey,
  treasuryPubkey: PublicKey,
) => {

    // Create new initiate play transaction
    let transaction = new Transaction();
    const instruction = new TransactionInstruction({
        keys: [{pubkey: wallet.publicKey, isSigner: true, isWritable: true},
               {pubkey: claimerAccountPubkey, isSigner: false, isWritable: true},
               {pubkey: auctionInfoPubkey, isSigner: false, isWritable: true},
               {pubkey: sysvarClockPubKey, isSigner: false, isWritable: false},
               {pubkey: sysvarSlotHashesPubKey, isSigner: false, isWritable: false},
               {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
               {pubkey: splTokenProgramPubKey, isSigner: false, isWritable: false},
               {pubkey: activePlayersListPubkey, isSigner: false, isWritable: true},
               {pubkey: allGameSquaresListPubkey, isSigner: false, isWritable: true},
               {pubkey: treasuryPubkey, isSigner: false, isWritable: true}],
        data: Buffer.from([
            7, ...longToByteArray(claimSquareNumber)
        ]),
        programId,
    });
    transaction.add(instruction);

    console.log('Sending Claim Prize transaction');
    let txid = await sendTransaction(connection, wallet, null, null, transaction, true);
    console.log('Attack Claim Prize sent');

    notify({
      message: "Claim Prize transaction sent",
      type: "success",
      txid: txid
    });
};


const getAccountInfo = async (connection: Connection, pubKey: PublicKey) => {
  const info = await connection.getAccountInfo(pubKey, "recent");
  if (info === null) {
    throw new Error("Failed to get account info");
  }
  return info;
};

export const getGameSquares = async (
  connection: Connection,
  allGameSquaresListPubkey: PublicKey,
) => {

    var MAX_SQUARES = 64;
    var gameSquareList:any[] = new Array(0);
    try {
        let info = await getAccountInfo(connection, allGameSquaresListPubkey);

        for(var i = 0;i<MAX_SQUARES;i++) {

            var offset = i * 56;

            const game_square_number = info.data.slice(offset, offset + 7);
            const game_square_number_int = byteArrayToLong(game_square_number);
            const team_number = info.data.slice(offset + 8, offset + 15);
            const team_number_int = byteArrayToLong(team_number);
            const health_number = info.data.slice(offset + 16, offset + 23);
            const health_number_int = byteArrayToLong(health_number);
            const mint_pubkey_bytes = info.data.slice(offset + 24, offset + 56);
            const key = new PublicKey(Buffer.from(mint_pubkey_bytes));
            const mint_pubkey = key.toBase58();

            if (mint_pubkey != "11111111111111111111111111111111") {
              var gameSquare =  {
                  id: game_square_number_int,
                  is_active: game_square_number_int,
                  game_square_number: game_square_number_int,
                  team_number: team_number_int,
                  health_number: health_number_int,
                  mint_pubkey: mint_pubkey,
              }
              gameSquareList.push(gameSquare);
            }
        }
    } catch (err) {
        console.log(err);
    }
    return gameSquareList;
};

export const getActivePlayers = async (
  connection: Connection,
  activePlayersListPubkey: PublicKey,
) => {

    var MAX_SQUARES = 64;
    var activePlayers:any[] = new Array(0);
    try {
        let info = await getAccountInfo(connection, activePlayersListPubkey);

        for(var i = 0;i<MAX_SQUARES;i++) {

            var offset = i * 72;

            const game_square_number = info.data.slice(offset, offset + 7);
            const game_square_number_int = byteArrayToLong(game_square_number);
            const owner_pubkey_bytes = info.data.slice(offset + 8, offset + 40);
            const owner_pubkey = new PublicKey(Buffer.from(owner_pubkey_bytes));
            const owner_pubkey_str = owner_pubkey.toBase58();
            const program_token_account_bytes = info.data.slice(offset + 41, offset + 73);
            const program_token_account_pubkey = new PublicKey(Buffer.from(program_token_account_bytes));
            const program_token_account_pubkey_str = program_token_account_pubkey.toBase58();

            if (owner_pubkey_str != "11111111111111111111111111111111") {
              var activePlayer =  {
                  id: game_square_number_int,
                  game_square_number: game_square_number_int,
                  owner_pubkey: owner_pubkey_str,
                  program_token_account_pubkey: program_token_account_pubkey_str,
              }
              activePlayers.push(activePlayer);
            }
        }
    } catch (err) {
        console.log(err);
    }
    return activePlayers;
};

export const getAuctionList = async (
  connection: Connection,
  auctionListPubkey: PublicKey,
) => {

    var MAX_BIDS = 1000;
    var auctionList:any[] = new Array(0);
    try {
        let info = await getAccountInfo(connection, auctionListPubkey);
        for(var i = 0;i<MAX_BIDS;i++) {

            var offset = i * 48

            let bid_number = info.data.slice(offset, offset + 7);
            let bid_number_int = byteArrayToLong(bid_number);
            let amount_lamports = info.data.slice(offset + 8, offset + 15);
            let amount_lamports_int = byteArrayToLong(amount_lamports);
            let bidder_pubkey_bytes = info.data.slice(offset + 16, offset + 48);
            var key = new PublicKey(Buffer.from(bidder_pubkey_bytes));
            let bidder = key.toBase58();

            if (bidder != "11111111111111111111111111111111") {
              var bidEntry =  {
                  id: bid_number_int,
                  bid_number: bid_number_int,
                  amount: amount_lamports_int / LAMPORTS_PER_SOL,
                  bidder: bidder,
              }
              auctionList.push(bidEntry);
            }
        };
    } catch (err) {
        console.log(err);
    }
    return auctionList;
};

export const getAuctionInfo = async (
  connection: Connection,
  auctionInfoPubkey: PublicKey,
) => {
    var bid_count = 0;
    var squares_minted = 0;
    var auction_end_slot = 0;
    try {
        let info = await getAccountInfo(connection, auctionInfoPubkey);
        const bid_count_bytes = info.data.slice(0, 7);
        bid_count = byteArrayToLong(bid_count_bytes);
        const squares_minted_bytes = info.data.slice(8, 15);
        squares_minted = byteArrayToLong(squares_minted_bytes);
        const auction_end_slot_bytes = info.data.slice(16, 23);
        auction_end_slot = byteArrayToLong(auction_end_slot_bytes);
    } catch (err) {
        console.log(err);
    }
    return {
        bid_count: bid_count,
        squares_minted: squares_minted,
        auction_end_slot: auction_end_slot,
    };
};

export const getCurrentSlot = async (
  connection: Connection
) => {
    var lastSlot = 0;
    try {
        lastSlot = await connection.getSlot();
    } catch (err) {
        console.log(err);
    }
    return lastSlot;
};

export const sendTransaction = async (
  connection: Connection,
  wallet: any,
  signer: any,
  signer2: any,
  transaction: Transaction,
  awaitConfirmation = true,
) => {
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;

  let signedTransaction;

  if (signer && signer2) {
      transaction.setSigners(
        wallet.publicKey,
        signer.publicKey,
        signer2.publicKey
      );
      transaction.partialSign(signer);
      transaction.partialSign(signer2);
  } else if (signer) {
        transaction.setSigners(
          wallet.publicKey,
          signer.publicKey,
        );
        transaction.partialSign(signer);
    } else {
      transaction.setSigners(
        wallet.publicKey,
      );
  }

  signedTransaction = await wallet.signTransaction(transaction);
  signedTransaction.feePayer = wallet.publicKey;

  const rawTransaction = signedTransaction.serialize();
  let options = {
    skipPreflight: true,
    commitment: "singleGossip",
  };
  let txid = '';
  try {
      txid = await connection.sendRawTransaction(rawTransaction, options);
  } catch(err) {
      console.log(err);
  }
  console.log('Sent transaction with txid: ' + txid);
  if (awaitConfirmation) {
    const status = (
      await connection.confirmTransaction(
        txid,
        options && (options.commitment as any)
      )
    ).value;
    console.log("Status for " + txid);
    console.log(status);
  }
  return txid;
};

// TODO: merge this..
export async function signTransactions({
  transactionsAndSigners,
  wallet,
  connection,
}: {
  transactionsAndSigners: {
    transaction: Transaction;
    signers?: Array<Account>;
  }[];
  wallet: WalletAdapter;
  connection: Connection;
}) {

  const blockhash = (await connection.getRecentBlockhash('max')).blockhash;
  transactionsAndSigners.forEach(({ transaction, signers = [] }) => {
    transaction.recentBlockhash = blockhash;
    if (typeof wallet == "undefined" || wallet.publicKey == null) {
      throw new Error('Missing wallet');
    }
    transaction.setSigners(
      wallet.publicKey,
      ...signers.map((s) => s.publicKey),
    );
    if (signers?.length > 0) {
      transaction.partialSign(...signers);
    }
  });
  return await wallet.signAllTransactions(
    transactionsAndSigners.map(({ transaction }) => transaction),
  );
}

export async function sendSignedTransaction({
  signedTransaction,
  connection,
  sendingMessage = 'Sending transaction...',
  sentMessage = 'Transaction sent',
  successMessage = 'Transaction confirmed',
  timeout = DEFAULT_TIMEOUT,
}: {
  signedTransaction: Transaction;
  connection: Connection;
  sendingMessage?: string;
  sentMessage?: string;
  successMessage?: string;
  timeout?: number;
}): Promise<string> {
  const rawTransaction = signedTransaction.serialize();
  const startTime = getUnixTs();
  notify({ message: sendingMessage });
  const txid: TransactionSignature = await connection.sendRawTransaction(
    rawTransaction,
    {
      skipPreflight: true,
    },
  );
  notify({ message: sentMessage, type: 'success', txid });

  console.log('Started awaiting confirmation for', txid);

  let done = false;
  (async () => {
    while (!done && getUnixTs() - startTime < timeout) {
      connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
      });
      await sleep(300);
    }
  })();
  try {
    await awaitTransactionSignatureConfirmation(txid, timeout, connection);
  } catch (err) {
    if (err.timeout) {
      throw new Error('Timed out awaiting confirmation on transaction');
    }
    let simulateResult: SimulatedTransactionResponse | null = null;
    try {
      simulateResult = (
        await simulateTransaction(connection, signedTransaction, 'single')
      ).value;
    } catch (e) {}
    if (simulateResult && simulateResult.err) {
      if (simulateResult.logs) {
        for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
          const line = simulateResult.logs[i];
          if (line.startsWith('Program log: ')) {
            throw new Error(
              'Transaction failed: ' + line.slice('Program log: '.length),
            );
          }
        }
      }
      throw new Error(JSON.stringify(simulateResult.err));
    }
    throw new Error('Transaction failed');
  } finally {
    done = true;
  }
  notify({ message: successMessage, type: 'success', txid });

  console.log('Latency', txid, getUnixTs() - startTime);
  return txid;
}


async function awaitTransactionSignatureConfirmation(
  txid: TransactionSignature,
  timeout: number,
  connection: Connection,
) {
  let done = false;
  const result = await new Promise((resolve, reject) => {
    (async () => {
      setTimeout(() => {
        if (done) {
          return;
        }
        done = true;
        console.log('Timed out for txid', txid);
        reject({ timeout: true });
      }, timeout);
      try {
        connection.onSignature(
          txid,
          (result) => {
            console.log('WS confirmed', txid, result);
            done = true;
            if (result.err) {
              reject(result.err);
            } else {
              resolve(result);
            }
          },
          'recent',
        );
        console.log('Set up WS connection', txid);
      } catch (e) {
        done = true;
        console.log('WS error in setup', txid, e);
      }
      while (!done) {
        // eslint-disable-next-line no-loop-func
        (async () => {
          try {
            const signatureStatuses = await connection.getSignatureStatuses([
              txid,
            ]);
            const result = signatureStatuses && signatureStatuses.value[0];
            if (!done) {
              if (!result) {
                console.log('REST null result for', txid, result);
              } else if (result.err) {
                console.log('REST error for', txid, result);
                done = true;
                reject(result.err);
              } else if (!result.confirmations) {
                console.log('REST no confirmations for', txid, result);
              } else {
                console.log('REST confirmation for', txid, result);
                done = true;
                resolve(result);
              }
            }
          } catch (e) {
            if (!done) {
              console.log('REST connection error: txid', txid, e);
            }
          }
        })();
        await sleep(300);
      }
    })();
  });
  done = true;
  return result;
}

/** Copy of Connection.simulateTransaction that takes a commitment parameter. */
async function simulateTransaction(
  connection: Connection,
  transaction: Transaction,
  commitment: Commitment,
): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
  // @ts-ignore
  transaction.recentBlockhash = await connection._recentBlockhash(
    // @ts-ignore
    connection._disableBlockhashCaching,
  );

  const signData = transaction.serializeMessage();
  // @ts-ignore
  const wireTransaction = transaction._serialize(signData);
  const encodedTransaction = wireTransaction.toString('base64');
  const config: any = { encoding: 'base64', commitment };
  const args = [encodedTransaction, config];

  // @ts-ignore
  const res = await connection._rpcRequest('simulateTransaction', args);
  if (res.error) {
    throw new Error('failed to simulate transaction: ' + res.error.message);
  }
  return res.result;
}
