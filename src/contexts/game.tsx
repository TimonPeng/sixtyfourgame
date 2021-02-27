
import {
  BpfLoader,
  BPF_LOADER_DEPRECATED_PROGRAM_ID,
  PublicKey,
  LAMPORTS_PER_SOL,
  Account,
  clusterApiUrl,
  Connection,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";
import {AccountLayout, u64, MintInfo, MintLayout, Token} from "@solana/spl-token";
import React, { useContext, useEffect, useMemo } from "react";

let TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

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
  payerAccount: Account,
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
    await sendTransaction(connection, wallet, treasuryFundAccount, null, transaction, true);
    console.log('Bid transaction sent');
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
  allGameSquaresListPubkey: PublicKey
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
               {pubkey: allGameSquaresListPubkey, isSigner: false, isWritable: true}],
        data: Buffer.from([3]),
        programId,
    });
    transaction.add(instruction);

    console.log('Sending Claim transaction');
    await sendTransaction(connection, wallet, mintAccount, tokenAccount, transaction, true);
    console.log('Claim transaction sent');
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
    var game_square_number_int = 0;
    var team_number_int = 0;
    var health_number_int = 0;
    var mint_pubkey = '';
    try {
        let info = await getAccountInfo(connection, allGameSquaresListPubkey);

        // TODO: all 64 squares

        const game_square_number = info.data.slice(0, 7);
        game_square_number_int = byteArrayToLong(game_square_number);

        const team_number = info.data.slice(8, 15);
        team_number_int = byteArrayToLong(team_number);

        const health_number = info.data.slice(16, 23);
        health_number_int = byteArrayToLong(health_number);

        const mint_pubkey_bytes = info.data.slice(24, 56);
        var key = new PublicKey(Buffer.from(mint_pubkey_bytes));
        mint_pubkey = key.toBase58();

    } catch (err) {
        console.log(err);
    }

    return {
        game_square_number: game_square_number_int,
        team_number: team_number_int,
        health_number: health_number_int,
        mint_pubkey: mint_pubkey,
    };
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
