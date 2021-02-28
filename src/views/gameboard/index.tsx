import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Button, Col, Row } from "antd";
import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ConnectButton } from "../../components/ConnectButton";
import { GameBoard } from "../../components/GameBoard";
import { useNativeAccount } from "../../contexts/accounts";
import { useConnection, useConnectionConfig } from "../../contexts/connection";
import { useWallet } from "../../contexts/wallet";
import { useMarkets } from "../../contexts/market";
import { formatNumber } from "../../utils/utils";
import { DataGrid, ColDef, RowsProp, CellParams } from '@material-ui/data-grid';
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
  getAllTokenAccounts
} from "../../contexts/game"
import configData from "../../config.json";
import {
  Account,
  PublicKey
} from '@solana/web3.js';

import { Modal } from "antd";

let programId = new PublicKey(configData.programId);
let payerAccount = new Account(Buffer.from(configData.payerSecretKey, "base64"));
let auctionListPubkey = new PublicKey(configData.auctionListPubkey);
let allGameSquaresListPubkey = new PublicKey(configData.allGameSquaresListPubkey);
let treasuryPubkey = new PublicKey(configData.treasuryPubkey);
let auctionInfoPubkey = new PublicKey(configData.auctionInfoPubkey);
let activePlayersListPubkey = new PublicKey(configData.activePlayersListPubkey);

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

  // Attack Modal
  const [isAttackModalVisible, setIsAttackModalVisible] = React.useState(false);
  const openAttackModal = React.useCallback((e) => {
    e.preventDefault()
    setIsAttackModalVisible(true);
  }, []);
  const closeAttackModal = React.useCallback(() => setIsAttackModalVisible(false), []);
  const [attackAmount, setAttackAmount] = React.useState(1);
  const [defendingSquareNumber, setDefendingSquareNumber] = React.useState(1);

  const refreshAttackAmount = React.useCallback((event) => {
      event.preventDefault();
      setAttackAmount(event.target.value);
  }, []);
  const refreshDefendingSquareNumber = React.useCallback((event) => {
      event.preventDefault();
      setDefendingSquareNumber(event.target.value);
  }, []);

  const balance = useMemo(
    () => formatNumber.format((account?.lamports || 0) / LAMPORTS_PER_SOL),
    [account]
  );

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
  const [rows, setRows] = React.useState([
      { id: 0, mint_pubkey: "There are no bids", is_active: "No", health_number: -1, team_number: -1, game_square_number: -1}
  ]);

  const columns: ColDef[] = [
    {
      field: 'game_square_number',
      headerName: '#',
      width: 110,
      headerClassName: 'text-white',
      renderCell: (params: CellParams) => (
          <strong className="display-flex">
              <p className="margin-top-3">{params.value as number + 1}</p>
              {connected && myGameSquares.indexOf(params.value as number) != -1 ?
                <form onSubmit={activeGameSquares.indexOf(params.value as number) != -1 ? openAttackModal : handleSubmitInitiatePlay}>
                  <input className="display-none" type="number" name="game_square_number" value={params.value as number} />
                  <input className="button" type="submit" value={activeGameSquares.indexOf(params.value as number) != -1 ? "Attack!" : "Activate"} />
                </form> : <p></p> }
          </strong>
      ),
    },
    {
      field: 'is_active',
      headerName: 'Active',
      width: 100,
      headerClassName: 'text-white',
      renderCell: (params: CellParams) => (
          <strong>
              {activeGameSquares.indexOf(params.value as number) != -1 ? "Yes" : "No"}
          </strong>
      ),
    },
    {
      field: 'team_number',
      headerName: 'Team',
      width: 100,
      headerClassName: 'text-white',
      renderCell: (params: CellParams) => (
          <strong>
              { params.value == "0" ?
                  <div className="text-red">RED</div> : ""}
              {params.value == "1" ?
                  <div className="text-blue">BLUE</div> : ""}
              {params.value == "2" ?
                  <div className="text-green">GREEN</div> : ""}
              {params.value == "3" ?
                  <div className="text-orange">ORANGE</div> : ""}
          </strong>
      ),
    },
    { field: 'health_number', headerName: 'Health', width: 110, headerClassName: 'text-white'},
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

  const handleSubmitAttack = React.useCallback((event) => {
      event.preventDefault();
      console.log('attacking');
  }, [
    connected,
    wallet,
    connection,
    programId,
  ]);

  const handleUpdateGameSquares = React.useCallback(() => {
      (async () => {
          // All
          var gameSquareData: any = await getGameSquares(
              connection,
              allGameSquaresListPubkey
          );
          setRows(gameSquareData);

          // Active
          var activePlayersData: any = await getActivePlayers(
              connection,
              activePlayersListPubkey
          );
          var _activeGameSquares: any[] = [];
          activePlayersData.forEach(function(item: any) {
              _activeGameSquares.push(item.game_square_number);
          });
          setActiveGameSquares(_activeGameSquares);

          // Auction
          var auctionInfo: any = await getAuctionInfo(
              connection,
              auctionInfoPubkey
          );
          setSquaresMinted(auctionInfo.squares_minted);
          refreshTreasuryBalance();

          // Get my squares
          if (typeof wallet != "undefined" && wallet.publicKey != null) {
              let accounts = await getAllTokenAccounts(connection, wallet);
              var _myGameSquares: any[] = [];
              for(var i = 0; i < accounts.length; i++) {
                  for(var j = 0; j < gameSquareData.length; j++) {
                      if (accounts[i].account.data.parsed.info.mint == gameSquareData[j].mint_pubkey) {
                          _myGameSquares.push(gameSquareData[j].game_square_number);
                      }
                  }
              };
              setMyGameSquares(_myGameSquares);
          }
      })();
  }, [
    connected,
    connection,
    wallet,
    allGameSquaresListPubkey,
    auctionInfoPubkey
  ]);

  const handleSubmitInitiatePlay = React.useCallback((event) => {
      event.preventDefault();
      if (connected && wallet) {
          (async () => {
                // Get gamesquare mint
                let gameSquareMintPubkeyStr = '';
                let gameSquareNumber = event.target.elements.game_square_number.value;
                rows.forEach(function(item) {
                    if (item.game_square_number == gameSquareNumber) {
                        gameSquareMintPubkeyStr = item.mint_pubkey;
                    }
                });
                let gameSquareMintPubkey: PublicKey = new PublicKey(gameSquareMintPubkeyStr);
                console.log('Game square #: ' + gameSquareNumber);
                console.log('Game square mint: ' + gameSquareMintPubkeyStr);

                // Get owner's token account
                let gameSquareTokenAccountPubkey = await getGameSquareTokenAccount(connection, gameSquareMintPubkey);

                console.log('Game square token account ' + gameSquareTokenAccountPubkey.toBase58());

                await sendInitiatePlaySequence(
                    wallet,
                    gameSquareNumber,
                    connection,
                    programId,
                    gameSquareTokenAccountPubkey,
                    auctionInfoPubkey,
                    sysvarClockPubKey,
                    gameSquareMintPubkey,
                    splTokenProgramPubKey,
                    activePlayersListPubkey,
                    treasuryPubkey
                );

          })();
      }
  }, [
    connected,
    wallet,
    connection,
    programId,
  ]);

  if(refresh) {
    setRefresh(0);
    handleUpdateGameSquares();
  }

  useEffect(() => {
    if (wallet && connected) {
        setRefresh(1);


    }
  }, [wallet, connected, setRefresh]);

  return (
    <Row gutter={[16, 16]} align="middle">
      <Col span={24}>
        <h2>GameBoard</h2>
        <h3>Battle for The Prize, Winning Team Take All</h3>
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
                      sort: 'asc',
                    },
              ]}/>
          </div>
      </Col>
      <Modal
        title="Attack"
        okText="Attack"
        visible={isAttackModalVisible}
        okButtonProps={{ style: { display: "none" } }}
        onCancel={closeAttackModal}
        width={400}
      >
          <form onSubmit={handleSubmitAttack}>
            <div className="display-table-cell">
                <label>
                  Attack Amount (Health):
                </label>
                <input className="margin-top-3 text-black" type="number" name="attack_amount" value={attackAmount} onChange={refreshAttackAmount} />
            </div>
            <div className="display-table-cell">
                <label>
                  Defending Square Number:
                </label>
                <input className="margin-top-3 text-black" type="number" name="defending_square_number" value={defendingSquareNumber} onChange={refreshDefendingSquareNumber} />
            </div>
            <Button
              size="large"
              type="ghost"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                marginTop: 20,
                marginBottom: 8,
              }}
            >
              ATTACK
            </Button>
          </form>
      </Modal>

      <Col span={12}>
          <GameBoard
          gameSquares={rows}/>
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
