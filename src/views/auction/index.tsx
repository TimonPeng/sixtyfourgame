import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Button, Col, Row } from "antd";
import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ConnectButton } from "../../components/ConnectButton";
import { useNativeAccount } from "../../contexts/accounts";
import { useConnection, useConnectionConfig } from "../../contexts/connection";
import { useWallet } from "../../contexts/wallet";
import { useMarkets } from "../../contexts/market";
import { formatNumber } from "../../utils/utils";
import { getAuctionList, getAuctionEndSlot, getCurrentSlot, sendClaimSequence, sendBidSequence } from "../../contexts/game"
import { Store } from "../../store"

import {
  Account,
  PublicKey
} from '@solana/web3.js';


let programId = new PublicKey("7kTkLH3WfB733uW2Yb5tj8FfiQ8ZJrNhKunabWt4sxrU");
let payerAccount = new Account(Buffer.from("tCMVjvScIBgjfMpJncq3iTZo8wrlyRnOLbGkAktScUeGnsp+bvq7byUZQ+bLa5WDZU1fl2mDvov43tWp8W8pnA==", "base64"));
let auctionListPubkey = new PublicKey("FVGS6HZq1wYLDsbr4cwXbhrhipF99mLbMummP6TsbPbW");
let treasuryPubkey = new PublicKey("7j5dir857UATEdvgEf9Bku8qyGxBHR5Vdqfy16Bx2vUU");
let auctionEndSlotPubkey = new PublicKey("BchsxxThGAdGE9VaRNNTzXM82giapY3t6SzHSvPzE5Bb");


let splTokenProgramPubKey = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
let sysvarClockPubKey = new PublicKey('SysvarC1ock11111111111111111111111111111111');

export const AuctionView = () => {

  const connection = useConnection();
  const { wallet, connected, connect, select, provider } = useWallet();
  const { marketEmitter, midPriceInUSD } = useMarkets();
  const { tokenMap } = useConnectionConfig();
  const { account } = useNativeAccount();

  const [refresh, setRefresh] = React.useState(0);
  const [bidAmount, setBidAmount] = React.useState(1);
  const [currentBidder, setCurrentBidder] = React.useState("");
  const [currentBidAmount, setCurrentBidAmount] = React.useState(0);
  const [auctionActive, setAuctionActive] = React.useState(1);


  const [auctionEndSlot, setAuctionEndSlot] = React.useState("");
  const [auctionEndTime, setAuctionEndTime] = React.useState("");

  const balance = useMemo(
    () => formatNumber.format((account?.lamports || 0) / LAMPORTS_PER_SOL),
    [account]
  );

  const refreshBidAmount = React.useCallback((event) => {
      setBidAmount(event.target.value);
  }, []);

  useEffect(() => {
    const refreshTotal = () => {};

    handleUpdateAuctionList();

    const dispose = marketEmitter.onMarket(() => {
      refreshTotal();
    });

    refreshTotal();

    return () => {
      dispose();
    };
  }, [marketEmitter, midPriceInUSD, tokenMap]);

  const handleSubmit = React.useCallback((event) => {
      event.preventDefault();
      console.log('submitting bid');
      if (connected) {
          (async () => {
              await sendBidSequence(
                  bidAmount,
                  wallet,
                  connection,
                  programId,
                  payerAccount,
                  auctionListPubkey,
                  treasuryPubkey,
                  auctionEndSlotPubkey,
                  sysvarClockPubKey
              );
              setRefresh(1);
          })();
      }
  }, [connected, bidAmount, wallet, connection, programId, payerAccount, auctionListPubkey, treasuryPubkey, auctionEndSlotPubkey, sysvarClockPubKey]);


  const handleSubmitClaim = React.useCallback((event) => {
      event.preventDefault();
      console.log('submitting claim');
      if (connected) {
          (async () => {
              await sendClaimSequence(
                  wallet,
                  connection,
                  programId,
                  auctionListPubkey,
                  auctionEndSlotPubkey,
                  sysvarClockPubKey,
                  splTokenProgramPubKey
              );
              setRefresh(1);
          })();
      }
  }, [connected, bidAmount, wallet, connection, programId, auctionListPubkey, auctionEndSlotPubkey, sysvarClockPubKey, splTokenProgramPubKey]);

  const handleUpdateAuctionList = React.useCallback(() => {
      console.log('getting auction list');
      (async () => {
          type BidEntry = { amount: number; bidder: string };
          var auctionData: BidEntry = await getAuctionList(
              connection,
              auctionListPubkey
          );
          console.log(auctionData)
          setCurrentBidder(auctionData.bidder);
          setCurrentBidAmount(auctionData.amount);

          var auctionEndSlot: any = await getAuctionEndSlot(
              connection,
              auctionEndSlotPubkey
          );
          var currentSlot: any = await getCurrentSlot(
              connection
          );
          var min = ((auctionEndSlot - currentSlot) * 0.4 / 60).toFixed(2);
          if (parseFloat(min) < 0) {
              setAuctionActive(0);
          } else {
              setAuctionEndSlot(auctionEndSlot);
              setAuctionEndTime(min);
          }
      })();
  }, [connected, connection, auctionListPubkey, setCurrentBidAmount, setCurrentBidder, setAuctionEndSlot, setAuctionEndTime, auctionEndSlotPubkey, setAuctionActive]);

  if(refresh) {
    setRefresh(0);
    handleUpdateAuctionList();
  }

  return (
    <Row gutter={[16, 16]} align="middle">
      <Col span={24}>
        <h2>Auction</h2>
        <h4>Highest 64 bidders get the 64 gameboard squares</h4>
      </Col>

      <Col span={24}>
          <h4>Current bidder: {currentBidder}</h4>
          <h4>Current bid amount: {currentBidAmount / LAMPORTS_PER_SOL} SOL</h4>
          { auctionActive ?
              <h4>Auction ends at slot {auctionEndSlot} (approx {auctionEndTime} mintues)</h4>
              :
              <h4>Auction ended</h4>
          }
      </Col>

      { connected && auctionActive &&
        (<Col span={24}>
          <h3>Create New Bid</h3>
          <form onSubmit={handleSubmit}>
            <label>
              Bid Amount (SOL):
              <input className="text-black" type="number" value={bidAmount} onChange={refreshBidAmount}/>
            </label>
            <input className="text-black" type="submit" value="Submit" />
          </form>
        </Col>)
      }
      { !connected &&
        (<Col span={24}>
          <ConnectButton
            type="text"
            size="large"
            allowWalletChange={true}
            style={{ color: "#2abdd2" }}
          />
        </Col>)
      }
      { connected && !auctionActive &&
        (<Col span={24}>
          <h3>Claim your Game Square!</h3>
          <form onSubmit={handleSubmitClaim}>
            <input className="text-black" type="submit" value="Claim" />
          </form>
        </Col>)
      }

      { connected ?
        (<Col span={24}>
            <h3>My Bid</h3>
            You have no bid
        </Col>) : (
          <Col span={24}></Col>
        )
      }
      <Col span={8}>
        <Link to="/auction">
          <Button>Auction</Button>
        </Link>
      </Col>
      <Col span={8}>
        <Link to="/gameboard">
          <Button>GameBoard</Button>
        </Link>
      </Col>
      <Col span={8}>
        <Link to="/marketplace">
          <Button>Marketplace</Button>
        </Link>
      </Col>
      <Col span={24}>
        <div className="builton" />
      </Col>
    </Row>
  );
};
