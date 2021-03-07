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
  sendClaimPrizeSequence
} from "../../contexts/game"
import configData from "../../config.json";
import {
  Account,
  PublicKey
} from '@solana/web3.js';

import { Modal, Select } from "antd";
const { Option } = Select;

let programId = new PublicKey(configData.programId);
let auctionListPubkey = new PublicKey(configData.auctionListPubkey);
let allGameSquaresListPubkey = new PublicKey(configData.allGameSquaresListPubkey);
let treasuryPubkey = new PublicKey(configData.treasuryPubkey);
let auctionInfoPubkey = new PublicKey(configData.auctionInfoPubkey);
let activePlayersListPubkey = new PublicKey(configData.activePlayersListPubkey);

let splTokenProgramPubKey = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
let sysvarClockPubKey = new PublicKey('SysvarC1ock11111111111111111111111111111111');

// hardcode for now
let attackable = [
    [2,4,6,8],
    [1,3,9,11],
    [2,4,12,14],
    [1,3,5,15],
    [4,6,16,18],
    [1,5,7,19],
    [6,8,20,22],
    [1,7,9,23],
    [2,8,10,24],
    [9,11,25,27],
    [2,10,12,28],
    [3,11,13,29],
    [12,14,30,32],
    [3,13,15,33],
    [4,14,16,34],
    [5,15,17,35],
    [16,18,36,38],
    [5,17,19,39],
    [6,18,20,40],
    [7,19,21,41],
    [20,22,42,44],
    [7,21,23,45],
    [8,22,24,46],
    [9,23,25,47],
    [10,24,26,48],
    [25,27,49,51],
    [10,26,28,52],
    [11,27,29,53],
    [12,28,30,54],
    [13,29,31,55],
    [32,30,56,58],
    [13,31,33,59],
    [14,32,34,60],
    [15,33,35,61],
    [16,34,36,62],
    [17,35,37,63],
    [36,38,64],
    [17,37,39],
    [18,38,40],
    [19,39,41],
    [20,40,42],
    [21,41,43],
    [42,44],
    [21,43,45],
    [22,44,46],
    [23,45,47],
    [24,46,48],
    [25,47,49],
    [26,48,50],
    [49,51],
    [26,50,52],
    [27,51,53],
    [28,52,54],
    [29,53,55],
    [30,54,56],
    [31,55,57],
    [56,58],
    [31,57,59],
    [32,58,60],
    [33,59,61],
    [34,60,62],
    [35,61,63],
    [36,62,64],
    [37,63]
];

export const GameBoardView = () => {

  const connection = useConnection();
  const { wallet, connected, connect, select, provider } = useWallet();

  const [refresh, setRefresh] = React.useState(1);
  const { marketEmitter, midPriceInUSD } = useMarkets();
  const { tokenMap } = useConnectionConfig();
  const { account } = useNativeAccount();

  const [gameOver, setGameOver] = React.useState(false);
  const [prize, setPrize] = React.useState(0);
  const [squaresMinted, setSquaresMinted] = React.useState(0);

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
  const [defenderOptions , setDefenderOptions] = React.useState<number[]>([]);

  // Attack Modal
  const [isAttackModalVisible, setIsAttackModalVisible] = React.useState(false);
  const openAttackModal = React.useCallback((e) => {
    e.preventDefault()
    let attacker = e.target.elements.game_square_number.value;
    setAttackFromGameSquare(attacker);
    setAttackFromGameSquareNumber(parseInt(attacker as string) + 1);

    let _options:any = [];
    for(var i=0; i<attackable[attacker].length;i++) {
        // Check if active
        // TODO: check if on same team here
        if (activeGameSquares.indexOf(attackable[attacker][i]-1) != -1) {
            _options.push(attackable[attacker][i])
        }
    }
    setDefenderOptions(_options);
    setIsAttackModalVisible(true);
  }, [activeGameSquares]);
  const closeAttackModal = React.useCallback(() => setIsAttackModalVisible(false), []);
  const [attackAmount, setAttackAmount] = React.useState(1);
  const [defendingSquareNumber, setDefendingSquareNumber] = React.useState(1);

  const [attackFromGameSquare, setAttackFromGameSquare] = React.useState(0);
  const [attackFromGameSquareNumber, setAttackFromGameSquareNumber] = React.useState(0);

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

  const [rows, setRows] = React.useState([
      { id: 0, mint_pubkey: "There are no bids", is_active: "No", health_number: -1, team_number: -1, game_square_number: -1}
  ]);

  const columns: GridColDef[] = [
    {
      field: 'game_square_number',
      headerName: '#',
      width: 140,
      headerClassName: 'text-white',
      renderCell: (params: GridCellParams) => (
          <strong className="display-flex">
              <p className="margin-top-3">{params.value as number + 1}</p>
              {connected && myGameSquares.indexOf(params.value as number) != -1 ?
                <form onSubmit={activeGameSquares.indexOf(params.value as number) != -1 ? openAttackModal : handleSubmitInitiatePlay}>
                  <input className="display-none" type="number" name="game_square_number" value={params.value as number} />
                  <input className="button" type="submit" value="Activate" />
                </form> : <p></p> }
              {connected && !gameOver && myActiveGameSquares.indexOf(params.value as number) != -1 ?
                <form onSubmit={activeGameSquares.indexOf(params.value as number) != -1 ? openAttackModal : handleSubmitInitiatePlay}>
                  <input className="display-none" type="number" name="game_square_number" value={params.value as number} />
                  <input className="button" type="submit" value="Attack!" />
                </form> : <p></p> }
              {connected && !gameOver && myActiveGameSquares.indexOf(params.value as number) != -1 ?
                <form onSubmit={handleSubmitEndPlay}>
                  <input className="display-none" type="number" name="game_square_number" value={params.value as number} />
                  <input className="button" type="submit" value="Retreat!" />
                </form> : <p></p> }
              {connected && gameOver && myActiveGameSquares.indexOf(params.value as number) != -1 ?
                <form onSubmit={handleSubmitClaimPrize}>
                  <input className="display-none" type="number" name="game_square_number" value={params.value as number} />
                  <input className="button" type="submit" value="Claim Prize!" />
                </form> : <p></p> }
          </strong>
      ),
    },
    {
      field: 'is_active',
      headerName: 'Active',
      width: 100,
      headerClassName: 'text-white',
      renderCell: (params: GridCellParams) => (
          <strong>
              {activeGameSquares.indexOf(params.value as number) != -1 ? "Yes" : "No"}
          </strong>
      ),
    },
    {
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

  const onDefenderChange = React.useCallback((value) => {
      setDefendingSquareNumber(value);
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

  const handleSubmitClaimPrize = React.useCallback((event) => {
      event.preventDefault();
      let claimSquareNumber = event.target.elements.game_square_number.value;
      console.log('Claiming prize for square index ', claimSquareNumber);

      if (connected && wallet) {
          (async () => {

                var activePlayersData: any = await getActivePlayers(
                    connection,
                    activePlayersListPubkey
                );
                var winningPubkey: PublicKey = new PublicKey('11111111111111111111111111111111');
                for(var i = 0; i < activePlayersData.length; i++) {
                    if (activePlayersData[i].game_square_number == claimSquareNumber) {
                        winningPubkey = new PublicKey(activePlayersData[i].owner_pubkey);
                        break;
                    }
                }

                if (winningPubkey.toBase58() != "11111111111111111111111111111111"){
                    await sendClaimPrizeSequence(
                        wallet,
                        claimSquareNumber,
                        connection,
                        programId,
                        winningPubkey,
                        auctionInfoPubkey,
                        sysvarClockPubKey,
                        splTokenProgramPubKey,
                        activePlayersListPubkey,
                        allGameSquaresListPubkey,
                        treasuryPubkey
                    );
                    setRefresh(1);
                }
          })();
      }
  }, [
    connected,
    wallet,
    connection,
    programId,
    activePlayersListPubkey
  ]);

  const handleSubmitAttack = React.useCallback((event) => {
      event.preventDefault();
      console.log(
        'Attacking from ',
        event.target.elements.attack_from_game_square.value,
        ' to square ',
        event.target.elements.defending_square_number.value
      );
      if (connected && wallet) {
          (async () => {
                await sendAttackSequence(
                    wallet,
                    event.target.elements.attack_amount.value,
                    event.target.elements.attack_from_game_square.value,
                    event.target.elements.defending_square_number.value,
                    connection,
                    programId,
                    auctionInfoPubkey,
                    sysvarClockPubKey,
                    splTokenProgramPubKey,
                    activePlayersListPubkey,
                    allGameSquaresListPubkey,
                    treasuryPubkey
                );
                setRefresh(1);
          })();
      }
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
          for(var i=0; i<gameSquareData.length;i++) {
              if (gameSquareData[i].team_number == 99 || gameSquareData[i].team_number == 100) {
                  setGameOver(true);
                  break;
              }
          }

          // Active
          var activePlayersData: any = await getActivePlayers(
              connection,
              activePlayersListPubkey
          );
          var _activeGameSquares: any[] = [];
          var _myActiveGameSquares: any[] = [];
          for(var i = 0; i < activePlayersData.length; i++) {
              if (typeof wallet != "undefined" && wallet.publicKey != null) {
                  if (activePlayersData[i].owner_pubkey == wallet.publicKey.toBase58()) {
                      _myActiveGameSquares.push(activePlayersData[i].game_square_number);
                  }
              }
              _activeGameSquares.push(activePlayersData[i].game_square_number);
          }
          setActiveGameSquares(_activeGameSquares);
          setMyActiveGameSquares(_myActiveGameSquares);

          console.log('MY ACTIVE SQUARES');
          console.log(_myActiveGameSquares);

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
                      if (accounts[i].account.data.parsed.info.tokenAmount.amount == "1" &&
                        accounts[i].account.data.parsed.info.mint == gameSquareData[j].mint_pubkey) {
                          _myGameSquares.push(gameSquareData[j].game_square_number);
                      }
                  }
              };
              setMyGameSquares(_myGameSquares);
              console.log('MY INACTIVE SQUARES');
              console.log(_myGameSquares);
          }
      })();
  }, [
    connected,
    connection,
    wallet,
    allGameSquaresListPubkey,
    auctionInfoPubkey
  ]);

  const options = defenderOptions.map((result, index) => {
    return (
      <Option value={result} label={result}>
        <div className="demo-option-label-item">
            {result}
        </div>
    </Option>
    );
  });

  const handleSubmitEndPlay = React.useCallback((event) => {
      event.preventDefault();
      if (connected && wallet && typeof wallet != "undefined" && wallet.publicKey != null) {
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

                await sendEndPlaySequence(
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
        <h4>Entering Showdown in {0} mintues</h4>
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
        title={"Battle from Square #" + attackFromGameSquareNumber}
        okText="Attack"
        visible={isAttackModalVisible}
        okButtonProps={{ style: { display: "none" } }}
        onCancel={closeAttackModal}
        width={400}
      >
          <form onSubmit={handleSubmitAttack}>
            <input className="display-none" name="attack_from_game_square" value={attackFromGameSquare} />
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
                <input className="display-none" type="number" name="defending_square_number" value={defendingSquareNumber} onChange={refreshDefendingSquareNumber} />

                <Select defaultValue="Select Defender" style={{ width: "100%" }} onChange={onDefenderChange}>
                    {options}
                </Select>
            </div>
            <input type="submit" className="attack-btn" value="ATTACK" />
          </form>
      </Modal>

      <Col span={12}>
          <GameBoard
          gameSquares={rows}
          activeGameSquares={activeGameSquares}/>
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
