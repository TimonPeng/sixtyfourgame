import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Button, Col, Row } from "antd";
import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ConnectButton } from "../../components/ConnectButton";
import { useNativeAccount } from "../../contexts/accounts";
import { useMarkets } from "../../contexts/market";
import { useConnection, useConnectionConfig } from "../../contexts/connection";
import { useWallet } from "../../contexts/wallet";
import { formatNumber } from "../../utils/utils";
import { DataGrid, GridColDef, GridRowsProp, GridCellParams } from '@material-ui/data-grid';
import {
  getAuctionList,
  getAuctionInfo,
  getGameSquareTokenAccount,
  getCurrentSlot,
  getGameSquares,
  getActivePlayers,
  sendBidSequence,
  sendClaimSequence,
  sendInitiatePlaySequence,
  getAllTokenAccounts,
  sendAttackSequence,
  sendEndPlaySequence,
  sendClaimPrizeSequence,
  sendCreateMarketSequence
} from "../../contexts/game"
import configData from "../../config.json";
import {
  Account,
  PublicKey
} from '@solana/web3.js';
import { Anchor, Modal, Select } from "antd";
import axios from 'axios';

const { Option } = Select;

axios.defaults.baseURL = 'http://localhost:5001/api/';

let programId = new PublicKey(configData.programId);
let auctionListPubkey = new PublicKey(configData.auctionListPubkey);
let allGameSquaresListPubkey = new PublicKey(configData.allGameSquaresListPubkey);
let treasuryPubkey = new PublicKey(configData.treasuryPubkey);
let auctionInfoPubkey = new PublicKey(configData.auctionInfoPubkey);
let activePlayersListPubkey = new PublicKey(configData.activePlayersListPubkey);

let splTokenProgramPubKey = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
let sysvarClockPubKey = new PublicKey('SysvarC1ock11111111111111111111111111111111');

export const MarketplaceView = () => {

  const connection = useConnection();
  const { wallet, connected, connect, select, provider } = useWallet();

  const { marketEmitter, midPriceInUSD } = useMarkets();
  const { tokenMap } = useConnectionConfig();
  const { account } = useNativeAccount();

  const [refresh, setRefresh] = React.useState(1);
  const [gameOver, setGameOver] = React.useState(false);
  const [prize, setPrize] = React.useState(0);
  const [squaresMinted, setSquaresMinted] = React.useState(0);

  type Market = {
    _id: string,
    gameSquareNumber: number,
    marketId: string,
    baseMintId: string,
  };
  const [markets , setMarkets] = React.useState<Market[]>([]);
  const [marketNumbers , setMarketNumbers] = React.useState<number[]>([]);
  type GameSquare = {
    id: number,
    game_square_number: number,
    is_active: boolean,
    team_number: number,
    health_number: number,
    mint_pubkey: string,
  };
  const [gameSquares , setGameSquares] = React.useState<GameSquare[]>([]);
  const [myGameSquares , setMyGameSquares] = React.useState<number[]>([]);
  const [activeGameSquares , setActiveGameSquares] = React.useState<number[]>([]);
  const [myActiveGameSquares , setMyActiveGameSquares] = React.useState<number[]>([]);
  const [mySellableGameSquares , setMySellableGameSquares] = React.useState<number[]>([]);
  const [defenderOptions , setDefenderOptions] = React.useState<number[]>([]);
  const [rows, setRows] = React.useState([
      { id: 0, mint_pubkey: "There are no buy/sell orders", is_active: "No", health_number: -1, team_number: -1, game_square_number: -1}
  ]);
  const [sellGameSquareNumber, setSellGameSquareNumber] = React.useState(1);
  const [bidAmount, setBidAmount] = React.useState(1);

  const refreshBidAmount = React.useCallback((event) => {
      event.preventDefault();
      setBidAmount(event.target.value);
  }, []);

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

  const balance = useMemo(
    () => formatNumber.format((account?.lamports || 0) / LAMPORTS_PER_SOL),
    [account]
  );

  const handleSubmitCreateMarket = React.useCallback((event) => {
      event.preventDefault();
      var gameSquareNumber = event.target.elements.game_square_number.value;
      console.log(
        'Creating market for ',
        gameSquareNumber,
      );
      if (connected && wallet) {
          (async () => {
                var baseMintAddress;
                for(var i=0; i<rows.length;i++) {
                    if (rows[i].game_square_number == gameSquareNumber) {
                        baseMintAddress = new PublicKey(rows[i].mint_pubkey);
                    }
                }

                if (typeof baseMintAddress == "undefined") {
                  throw new Error('Missing baseMintAddress');
                }

                console.log('Base mint is: ', baseMintAddress);
                let marketAddress = await sendCreateMarketSequence(
                    wallet,
                    baseMintAddress,
                    connection,
                    programId,
                    auctionInfoPubkey,
                    sysvarClockPubKey,
                    splTokenProgramPubKey,
                    activePlayersListPubkey,
                    allGameSquaresListPubkey,
                    treasuryPubkey
                );

                if (typeof marketAddress != "undefined") {
                  let marketData = {
                    "gameSquareNumber": +gameSquareNumber + 1,
                    "marketId": marketAddress.toBase58(),
                    "baseMintId": baseMintAddress.toBase58()
                  }
                  axios.post('market/create', marketData)
                    .then(res => {
                      console.log('Sent market address to server');
                      console.log(res.data);
                    })
                    .catch(err => console.log(err))
                }

                setRefresh(1);
          })();
      }
  }, [
    connected,
    wallet,
    connection,
    programId,
    rows
  ]);

  const buyColumns: GridColDef[] = [
    {
      field: 'game_square_number',
      headerName: '#',
      width: 240,
      headerClassName: 'text-white',
      renderCell: (params: GridCellParams) => (
          <strong className="display-flex">
              <p className="margin-top-3">{params.value as number + 1}</p>
              {connected && params.value != null && marketNumbers.indexOf(+params.value + 1) == -1 ?
                  <form onSubmit={handleSubmitCreateMarket}>
                    <input className="display-none" type="number" name="game_square_number" value={params.value as number} />
                    <input className="button" type="submit" value="Create Market" />
                  </form> : <p></p> }
          </strong>
      ),
    }, {
      field: 'team_number',
      headerName: 'Team',
      width: 110,
      headerClassName: 'text-white',
      renderCell: (params: GridCellParams) => (
          <strong>
              { params.value == "0" ?
                  <div className="text-red">RED</div> : ""}
              {params.value == "1" ?
                  <div className="text-blue">BLUE</div> : ""}
              {params.value == "2" ?
                  <div className="text-green">GREEN</div> : ""}
              {params.value == "3" ?
                  <div className="text-orange">ORANGE</div> : ""}
              {params.value == "99" ?
                  <div className="text-white">GAME OVER</div> : ""}
              {params.value == "100" ?
                  <div className="text-white">CLAIMED</div> : ""}
          </strong>
      ),
    },
    { field: 'health_number', headerName: 'Health', width: 110, headerClassName: 'text-white'},
    { field: 'dex_link', headerName: 'Link to DEX Market', width: 400, headerClassName: 'text-white',
      renderCell: (params: GridCellParams) => (
          <strong className="display-flex">
              {markets.length > 0 && params != null && params.getValue("game_square_number")! != null &&
               marketNumbers.indexOf(+params.getValue("game_square_number")! + 1) != -1 &&
               typeof markets[+params.getValue("game_square_number")!]! != "undefined" ?
                    <a className="black-bg text-white" target="_blank" href={'https://dex.sixtyfourgame.com/#/market/' + (markets[+params.getValue("game_square_number")!]!.marketId)}>VIEW DEX MARKET</a> : <p></p> }
          </strong>
      ),
    },
  ];

  const onSellGameSquareChange = React.useCallback((value) => {
      setSellGameSquareNumber(value);
  }, []);

  const handleUpdateMarketplace = React.useCallback(() => {
      (async () => {
          // All
          var gameSquareData: any = await getGameSquares(
              connection,
              allGameSquaresListPubkey
          );
          setRows(gameSquareData);
          for(var i=0; i<gameSquareData.length;i++) {
              if (gameSquareData[i].team_number == 99 || gameSquareData[i].team_number == 100) {
                  setGameOver(true);
                  break;
              }
          }

          axios.get('/markets')
                .then(res => {
                  if(res.data){
                    setMarkets(res.data);

                    var _marketNumbers: any[] = [];
                    for(var i = 0; i < markets.length; i++) {
                        _marketNumbers.push(markets[i].gameSquareNumber);
                    }
                    setMarketNumbers(_marketNumbers);
                  }
                })
                .catch(err => console.log(err))

      })();
  }, [
    connected,
    connection,
    wallet,
    allGameSquaresListPubkey,
    auctionInfoPubkey,
    markets,
    marketNumbers
  ]);

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


  if(refresh) {
    setRefresh(0);
    handleUpdateMarketplace();
  }

  useEffect(() => {
    if (wallet && connected) {
        setRefresh(1);
    }
  }, [wallet, connected, setRefresh]);

  return (
    <Row gutter={[16, 16]} align="middle">
      <Col span={24}>
        <h2>Marketplace</h2>
        <h4>Buy or Sell 64 gameboard squares</h4>
      </Col>
      <Col span={4} >
      </Col>
      <Col span={16} >
          <div style={{ color: 'white', height: 700, width: '100%' }}>
            <DataGrid
                rows={rows}
                columns={buyColumns}
                sortModel={[
                    {
                      field: 'game_square_number',
                      sort: 'asc',
                    },
              ]}/>
          </div>
      </Col>
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
