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
import { getAuctionList, getAuctionInfo, getCurrentSlot, sendClaimSequence, sendBidSequence, getGameSquares } from "../../contexts/game"
import configData from "../../config.json";
import { DataGrid, GridColDef, GridRowsProp, GridCellParams } from '@material-ui/data-grid';
import { notify } from "../../utils/notifications";

import {
  Account,
  PublicKey
} from '@solana/web3.js';


let programId = new PublicKey(configData.programId);
let auctionListPubkey = new PublicKey(configData.auctionListPubkey);
let allGameSquaresListPubkey = new PublicKey(configData.allGameSquaresListPubkey);
let treasuryPubkey = new PublicKey(configData.treasuryPubkey);
let auctionInfoPubkey = new PublicKey(configData.auctionInfoPubkey);

console.log('programId ', programId);
console.log('auctionListPubkey ', auctionListPubkey.toBase58());
console.log('allGameSquaresListPubkey ', allGameSquaresListPubkey.toBase58());
console.log('treasuryPubkey ', treasuryPubkey.toBase58());
console.log('auctionInfoPubkey ', auctionInfoPubkey.toBase58());

let splTokenProgramPubKey = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
let sysvarClockPubKey = new PublicKey('SysvarC1ock11111111111111111111111111111111');

export const AuctionView = () => {

  const connection = useConnection();
  const { wallet, connected, connect, select, provider } = useWallet();
  const { marketEmitter, midPriceInUSD } = useMarkets();
  const { tokenMap } = useConnectionConfig();
  const { account } = useNativeAccount();

  const [refresh, setRefresh] = React.useState(0);
  const [bidAmount, setBidAmount] = React.useState(0.1);
  const [currentBidder, setCurrentBidder] = React.useState("");
  const [currentBidAmount, setCurrentBidAmount] = React.useState(0);
  const [auctionActive, setAuctionActive] = React.useState(1);

  const [auctionEndSlot, setAuctionEndSlot] = React.useState("");
  const [auctionEndTime, setAuctionEndTime] = React.useState("");

  const [prize, setPrize] = React.useState(0);
  const [bidCount, setBidCount] = React.useState(0);
  const [squaresMinted, setSquaresMinted] = React.useState(0);

  type Bid = {id: number, amount: number, bidder: string, bid_number: number};
  const [myBids , setMyBids] = React.useState<Bid[]>([]);
  const [myBidNumbers , setMyBidNumbers] = React.useState<number[]>([]);
  const [rows, setRows] = React.useState([
      { id: 0, bidder: "There are no bids", bid_number: -1, bidder_pubkey: '', amount: 0, rank: 1}
  ]);

  const columns: GridColDef[] = [
    {
      field: 'rank',
      headerName: 'Rank',
      width: 90,
      headerClassName: 'text-white',
      renderCell: (params: GridCellParams) => (
          <strong className={params.value as number <= (64 - squaresMinted) ? "text-green" : "text-red"}>
              {params.value}
          </strong>
      ),
    },
    {
      field: 'bid_number',
      headerName: 'Action',
      width: 110,
      headerClassName: 'text-white',
      renderCell: (params: GridCellParams) => (
          <strong>
            { connected && !auctionActive ?
              <form onSubmit={handleSubmitClaim}>
                <input className="display-none" type="number" name="bid_number" value={params.value as number} />
                <input className="button" type="submit" value={auctionActive ? '' : 'Resolve'} />
              </form> : <p></p> }
          </strong>
      ),
    },
    { field: 'amount', headerName: 'Bid Amount (SOL)', width: 200, headerClassName: 'text-white'},
    { field: 'bidder', headerName: 'Bid Pubkey', width: 400, headerClassName: 'text-white' },
  ];

  const balance = useMemo(
    () => formatNumber.format((account?.lamports || 0) / LAMPORTS_PER_SOL),
    [account]
  );

  const refreshBidAmount = React.useCallback((event) => {
      setBidAmount(event.target.value);
  }, []);

  const airdrop = React.useCallback(() => {
    if (wallet) {
        connection.requestAirdrop(wallet.publicKey as any, 2 * LAMPORTS_PER_SOL).then(() => {
          notify({
            message: "Airdrop successful",
            type: "success",
          });
        });
    }
  }, [wallet, connection]);

  const refreshTreasuryBalance = React.useCallback(() => {
      (async () => {
        try {
          const balance = await connection.getBalance(
            treasuryPubkey,
            "singleGossip"
          );
          setPrize(balance/LAMPORTS_PER_SOL);
        } catch (err) {
            console.log(err);
        }
      })();
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
      if (connected) {
          (async () => {
              await sendBidSequence(
                  bidAmount,
                  wallet,
                  connection,
                  programId,
                  auctionListPubkey,
                  treasuryPubkey,
                  auctionInfoPubkey,
                  sysvarClockPubKey
              );
              setRefresh(1);
          })();
      }
  }, [connected, bidAmount, wallet, connection, programId, auctionListPubkey, treasuryPubkey, auctionInfoPubkey, sysvarClockPubKey]);


  const handleSubmitClaim = React.useCallback((event) => {
      event.preventDefault();
      if (connected) {
          (async () => {
              let bidEntryPubkeyStr = '';
              let bidNumber = event.target.elements.bid_number.value;
              rows.forEach(function(item) {
                  if (item.bid_number == bidNumber) {
                      bidEntryPubkeyStr = item.bidder;
                  }
              });
              let bidEntryPubkey: PublicKey = new PublicKey(bidEntryPubkeyStr);
              await sendClaimSequence(
                  wallet,
                  connection,
                  programId,
                  bidEntryPubkey,
                  auctionListPubkey,
                  auctionInfoPubkey,
                  sysvarClockPubKey,
                  splTokenProgramPubKey,
                  allGameSquaresListPubkey,
                  treasuryPubkey
              );
              setRefresh(1);
          })();
      }
  }, [
    connected,
    bidAmount,
    wallet,
    connection,
    programId,
    auctionListPubkey,
    auctionInfoPubkey,
    sysvarClockPubKey,
    splTokenProgramPubKey,
    allGameSquaresListPubkey,
    rows,
    treasuryPubkey
  ]);

  const handleUpdateAuctionList = React.useCallback(() => {
      (async () => {
          var auctionData: any[] = await getAuctionList(
              connection,
              auctionListPubkey
          );
          var _myBids: any[] = [];
          var _myBidNumbers: any[] = [];
          auctionData.forEach(function(item) {
              if (typeof wallet !== "undefined" && item.bidder == wallet.publicKey) {
                  _myBids.push(item);
                  _myBidNumbers.push(item.bid_number);
              }
          });
          setMyBids(_myBids);
          setMyBidNumbers(_myBidNumbers);
          setRows(auctionData);

          var auctionInfo: any = await getAuctionInfo(
              connection,
              auctionInfoPubkey
          );
          var currentSlot: any = await getCurrentSlot(
              connection
          );

          setBidCount(auctionInfo.bid_count);
          setSquaresMinted(auctionInfo.squares_minted);

          var min = ((auctionInfo.auction_end_slot - currentSlot) * 0.4 / 60).toFixed(2);
          if (parseFloat(min) < 0) {
              setAuctionActive(0);
          } else {
              setAuctionEndSlot(auctionInfo.auction_end_slot);
              setAuctionEndTime(min);
          }

          var gameSquareData: any = await getGameSquares(
              connection,
              allGameSquaresListPubkey
          );
          console.log(gameSquareData);

          refreshTreasuryBalance();

      })();
  }, [
    connected,
    connection,
    auctionListPubkey,
    setCurrentBidAmount,
    setCurrentBidder,
    setAuctionEndSlot,
    setAuctionEndTime,
    auctionInfoPubkey,
    setAuctionActive,
    allGameSquaresListPubkey,
    setRows,
    setMyBids,
    setMyBidNumbers,
    wallet,
    setPrize,
    setBidCount,
    setSquaresMinted,
  ]);

  if(refresh) {
    setRefresh(0);
    handleUpdateAuctionList();
  }


  const results = rows.sort((a, b) => a.amount < b.amount ? 1:-1).map((result, index) => {
    result.rank = index + 1;
    return result;
  });

  useEffect(() => {
    if (wallet && connected) {
      setRefresh(1);
    }
    return () => {};
  }, [wallet, connected, setRefresh]);

  return (
    <Row gutter={[16, 16]} align="middle">
      <Col span={24}>
        <h2>Auction</h2>
        <h4>Highest 64 bidders get the 64 gameboard squares</h4>
        { auctionActive ?
            <h4>Auction ends at slot {auctionEndSlot} (approx {auctionEndTime} mintues)</h4>
            :
            <h4>Auction ended</h4>
        }
        <h4>The Prize: {prize} SOL - Bid Count: {bidCount} - GameSquares Minted: {squaresMinted}</h4>
      </Col>

      <Col span={12} >
          <h3>Highest Bidders</h3>
          <div style={{ color: 'white', height: 500, width: '100%' }}>
            <DataGrid
                rows={results}
                columns={columns}
                sortModel={[
                    {
                      field: 'amount',
                      sort: 'desc',
                    },
              ]}/>
          </div>
      </Col>

      { connected && auctionActive ?
        (<Col span={12}>
          <h3>Create New Bid</h3>
          <ConnectButton type="primary" onClick={airdrop}>
            Airdrop
          </ConnectButton>
          <form onSubmit={handleSubmit}>
            <label>
              Bid Amount (SOL):
              <input className="text-black" type="number" value={bidAmount} onChange={refreshBidAmount}/>
            </label>
            <input className="text-black" type="submit" value="Submit" />
          </form>
        </Col>) : (
          <Col span={0}>
          </Col>
        )
      }

      { connected && !auctionActive ?
        (<Col span={12}>
          <h3>Auction Completed</h3>
          <h3>Claim your GameSquare NFT or return your funds</h3>
          <h3>by clicking the "Resolve" button in the table</h3>
          <br></br>
          <h4>(GameSquares 1-64 must be resolved IN ORDER)</h4>
          <h4>(Tie goes to whoever submitted their bid first)</h4>
        </Col>) : (
          <Col span={0}>
          </Col>
        )
      }

      { !connected &&
        <Col span={12}>
          <ConnectButton
            type="text"
            size="large"
            allowWalletChange={true}
            style={{ color: "#2abdd2" }}
          />
        </Col>
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
