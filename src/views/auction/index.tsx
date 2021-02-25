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
import { getAuctionList, sendBidSequence } from "../../contexts/game"
import { Store } from "../../store"

import {
  Account,
  PublicKey
} from '@solana/web3.js';


let programId = new PublicKey("4Hh4rQzHDCtwGZ8gzqTsYkYjVyuRNhnW8WFuWjzqyjqM");
let payerAccount = new Account(Buffer.from("oY+l5UZq8zKs2AW8uNYkv5Q87/0E4gvsOywtkbRYOu1radCIrCpLGvCaR0nisKTB5AHfe+oCR+o5qoBNZbUVOw==", "base64"));
let auctionListPubkey = new PublicKey("7sk6uC9C5kfCc6Cs9sEqA5Ai1wUhYVpejtqJWQngc8b5");
let treasuryPubkey = new PublicKey("7oSLdzAxooNwS1e1udPLK84uTgkwHdG3AGoXay254nxc");

export const AuctionView = () => {

  const connection = useConnection();
  const { wallet, connected, connect, select, provider } = useWallet();
  const { marketEmitter, midPriceInUSD } = useMarkets();
  const { tokenMap } = useConnectionConfig();
  const { account } = useNativeAccount();

  const [bidAmount, setBidAmount] = React.useState(1);
  const [currentBidder, setCurrentBidder] = React.useState("");
  const [currentBidAmount, setCurrentBidAmount] = React.useState(0);

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
                  treasuryPubkey
              );
          })();
      }
  }, [connected, bidAmount, wallet, connection, programId, payerAccount, auctionListPubkey, treasuryPubkey]);

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
      })();
  }, [connected, connection, auctionListPubkey, setCurrentBidAmount, setCurrentBidder]);

  handleUpdateAuctionList();

  return (
    <Row gutter={[16, 16]} align="middle">
      <Col span={24}>
        <h2>Auction</h2>
        <h4>Highest 64 bidders get the 64 gameboard squares</h4>
      </Col>

      <Col span={24}>
          <h4>Current bidder: {currentBidder}</h4>
          <h4>Current bid amount: {currentBidAmount / LAMPORTS_PER_SOL} SOL</h4>
      </Col>

      { connected ?
        (<Col span={24}>
          <h3>Create New Bid</h3>
          <form onSubmit={handleSubmit}>
            <label>
              Bid Amount (SOL):
              <input className="text-black" type="number" value={bidAmount} onChange={refreshBidAmount}/>
            </label>
            <input className="text-black" type="submit" value="Submit" />
          </form>
        </Col>) : (
        <Col span={24}>
          <ConnectButton
            type="text"
            size="large"
            allowWalletChange={true}
            style={{ color: "#2abdd2" }}
          />
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
