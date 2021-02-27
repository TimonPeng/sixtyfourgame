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
import { DataGrid, ColDef, RowsProp, CellParams } from '@material-ui/data-grid';
import { getAuctionList, getAuctionInfo, getCurrentSlot, sendClaimSequence, sendBidSequence, getGameSquares } from "../../contexts/game"
import configData from "../../config.json";

import {
  Account,
  PublicKey
} from '@solana/web3.js';

let programId = new PublicKey(configData.programId);
let payerAccount = new Account(Buffer.from(configData.payerSecretKey, "base64"));
let auctionListPubkey = new PublicKey(configData.auctionListPubkey);
let allGameSquaresListPubkey = new PublicKey(configData.allGameSquaresListPubkey);
let treasuryPubkey = new PublicKey(configData.treasuryPubkey);
let auctionInfoPubkey = new PublicKey(configData.auctionInfoPubkey);

let splTokenProgramPubKey = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
let sysvarClockPubKey = new PublicKey('SysvarC1ock11111111111111111111111111111111');

export const GameBoardView = () => {

  const connection = useConnection();
  const { wallet, connected, connect, select, provider } = useWallet();

  const [refresh, setRefresh] = React.useState(1);
  const { marketEmitter, midPriceInUSD } = useMarkets();
  const { tokenMap } = useConnectionConfig();
  const { account } = useNativeAccount();

  const [prize, setPrize] = React.useState(0);
  const [squaresMinted, setSquaresMinted] = React.useState(0);

  const balance = useMemo(
    () => formatNumber.format((account?.lamports || 0) / LAMPORTS_PER_SOL),
    [account]
  );

  type GameSquare = {
    id: number,
    game_square_number: number,
    team_number: number,
    health_number: number,
    mint_pubkey: string,
  };
  const [gameSquares , setGameSquares] = React.useState<GameSquare[]>([]);
  const [myGameSquares , setMyGameSquares] = React.useState<number[]>([]);
  const [rows, setRows] = React.useState([
      { id: 0, mint_pubkey: "There are no bids", health_number: -1, team_number: -1, game_square_number: -1}
  ]);

  const columns: ColDef[] = [
    {
      field: 'game_square_number',
      headerName: '#',
      width: 110,
      headerClassName: 'text-white',
      renderCell: (params: CellParams) => (
          <strong>
              {params.value}
          </strong>
      ),
    },
    { field: 'team_number', headerName: 'Team', width: 110, headerClassName: 'text-white'},
    { field: 'health_number', headerName: 'Health', width: 200, headerClassName: 'text-white'},
    { field: 'mint_pubkey', headerName: 'Mint Pubkey', width: 400, headerClassName: 'text-white' },
  ];

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

    const dispose = marketEmitter.onMarket(() => {
      refreshTotal();
    });

    refreshTotal();

    return () => {
      dispose();
    };
  }, [marketEmitter, midPriceInUSD, tokenMap]);

  const handleUpdateGameSquares = React.useCallback(() => {
      (async () => {
          var gameSquareData: any = await getGameSquares(
              connection,
              allGameSquaresListPubkey
          );
          setRows(gameSquareData);
          var auctionInfo: any = await getAuctionInfo(
              connection,
              auctionInfoPubkey
          );
          setSquaresMinted(auctionInfo.squares_minted);
          refreshTreasuryBalance();
      })();
  }, [
    connected,
    connection,
    allGameSquaresListPubkey,
    auctionInfoPubkey
  ]);

  if(refresh) {
    setRefresh(0);
    handleUpdateGameSquares();
  }

  return (
    <Row gutter={[16, 16]} align="middle">
      <Col span={24}>
        <h2>GameBoard</h2>
        <h3>Battle for The Prize, winners take all</h3>
        <h4>The Prize: {prize} SOL - GameSquares Minted: {squaresMinted}</h4>
      </Col>

      <Col span={12} >
          <h3>Game Squares</h3>
          <div style={{ color: 'white', height: 500, width: '100%' }}>
            <DataGrid
                rows={rows}
                columns={columns}
                sortModel={[
                    {
                      field: 'game_square_number',
                      sort: 'desc',
                    },
              ]}/>
          </div>
      </Col>

      { connected ?
        (<Col span={12}>
          <h3>GAME BOARD HERE</h3>
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
