
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
} from "@solana/web3.js";
import {AccountLayout, u64, MintInfo, MintLayout, Token} from "@solana/spl-token";
import React, { useContext, useEffect, useMemo } from "react";

const longToByteArray = function(long: any) {
    var byteArray = [0, 0, 0, 0, 0, 0, 0, 0];
    for ( var index = 0; index < byteArray.length; index ++ ) {
        var byte = long & 0xff;
        byteArray [ index ] = byte;
        long = (long - byte) / 256 ;
    }
    return byteArray;
};

export const sendBidSequence = async (
  amount: any,
  wallet: any,
  connection: any,
  programId: PublicKey,
  payerAccount: Account,
  auctionListAccount: Account,
) => {

    // Create new bid transaction
    let transaction = new Transaction();
    const instruction = new TransactionInstruction({
        keys: [{pubkey: wallet.publicKey, isSigner: true, isWritable: true},
               {pubkey: auctionListAccount.publicKey, isSigner: false, isWritable: true}],
        programId,
        data: Buffer.from([0, ...longToByteArray(amount * LAMPORTS_PER_SOL)]),
    });
    transaction.add(instruction);

    console.log('Sending Bid transaction');
    await sendTransaction(connection, wallet, transaction, true);
    console.log('Bid transaction sent');
};


const getAccountInfo = async (connection: Connection, pubKey: PublicKey) => {
  const info = await connection.getAccountInfo(pubKey, "recent");
  if (info === null) {
    throw new Error("Failed to get account info");
  }
  return info;
};

function Int64ToString(bytes:any, isSigned:any) {
    const isNegative = isSigned && bytes.length > 0 && bytes[0] >= 0x80;
    var digits: any = [];
    bytes.forEach((byte: any, j: any) => {
      if(isNegative)
        byte = 0x100 - (j == bytes.length - 1 ? 0 : 1) - byte;
      for(let i = 0; byte > 0 || i < digits.length; i++) {
        byte += (digits[i] || 0) * 0x100;
        digits[i] = byte % 10;
        byte = (byte - digits[i]) / 10;
      }
    });
    return (isNegative ? '-' : '') + digits.reverse().join('');
}


function byteArrayToLong(byteArray: any) {
    var value = 0;
    for ( var i = byteArray.length - 1; i >= 0; i--) {
        value = (value * 256) + byteArray[i];
    }

    return value;
};



type BidEntry = { amount: number; bidder: string };
export const getAuctionList = async (
  connection: Connection,
  auctionListAccount: Account,
) => {
    var bidder = '';
    var amount = 0;
    try {
        let info = await getAccountInfo(connection, auctionListAccount.publicKey);

        console.log("info is");
        console.log(info);

        const amount_lamports = info.data.slice(0, 7);
        const amount_lamports_int = byteArrayToLong(amount_lamports);

        console.log('Auction bid saved with amount: ' + amount_lamports_int);
        amount = amount_lamports_int;

        const bidder_pubkey_bytes = info.data.slice(8, 40);
        var key = new PublicKey(Buffer.from(bidder_pubkey_bytes));

        bidder = key.toBase58();
        console.log(bidder);


    } catch (err) {
        console.log(err);
    }

    return {
        amount: amount,
        bidder: bidder,
    };
};

export const sendTransaction = async (
  connection: Connection,
  wallet: any,
  transaction: Transaction,
  awaitConfirmation = true,
) => {
  transaction.recentBlockhash = (
    await connection.getRecentBlockhash("max")
  ).blockhash;

  transaction.setSigners(
    wallet.publicKey,
  );
  let signedTransaction = await wallet.signTransaction(transaction);
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
