import React from "react";
import { useWallet } from "../../contexts/wallet";
import { formatNumber, shortenAddress } from "../../utils/utils";
import { Identicon } from "../Identicon";
import { useNativeAccount } from "../../contexts/accounts";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";


type GameSquare = {
  id: number,
  game_square_number: number,
  team_number: number,
  health_number: number,
  mint_pubkey: string,
};

export const GameBoard = (props: {
  gameSquares: GameSquare[]
}) => {
  const { wallet } = useWallet();
  const { account } = useNativeAccount();

  console.log(props);
  const col1 = [43,42,41,40,39,38,37,64];
  const col2 = [44,21,20,19,18,17,36,63];
  const col3 = [45,22,7,6,5,16,35,62];
  const col4 = [46,23,8,1,4,15,34,61];
  const col5 = [47,24,9,2,3,14,33,60];
  const col6 = [48,25,10,11,12,13,32,59];
  const col7 = [49,26,27,28,29,30,31,58];
  const col8 = [50,51,52,53,54,55,56,57];

  return (
    <div className="gameboard-wrapper text-white display-inline-flex">
      <div className="gameboard-col">
        {col1.map(function(number, index){
            return props.gameSquares.map(function(square, index){
                if (number - 1 == square.game_square_number) {
                    var teamColor = '';
                    if (square.team_number == 0) {
                        teamColor = 'red';
                    } else if (square.team_number == 1) {
                        teamColor = 'blue';
                    } else if (square.team_number == 2) {
                        teamColor = 'green';
                    } else if (square.team_number == 3) {
                        teamColor = 'orange';
                    }
                    var classes = "game-square text-white " + teamColor + "-bg";
                    return <div className={classes}> {square.game_square_number + 1}</div>;
                }
            });
        })}
      </div>
      <div className="gameboard-col">
        {col2.map(function(number, index){
            return props.gameSquares.map(function(square, index){
                if (number - 1 == square.game_square_number) {
                    var teamColor = '';
                    if (square.team_number == 0) {
                        teamColor = 'red';
                    } else if (square.team_number == 1) {
                        teamColor = 'blue';
                    } else if (square.team_number == 2) {
                        teamColor = 'green';
                    } else if (square.team_number == 3) {
                        teamColor = 'orange';
                    }
                    var classes = "game-square text-white " + teamColor + "-bg";
                    return <div className={classes}> {square.game_square_number + 1}</div>;
                }
            });
        })}
      </div>
      <div className="gameboard-col">
        {col3.map(function(number, index){
            return props.gameSquares.map(function(square, index){
                if (number - 1 == square.game_square_number) {
                    var teamColor = '';
                    if (square.team_number == 0) {
                        teamColor = 'red';
                    } else if (square.team_number == 1) {
                        teamColor = 'blue';
                    } else if (square.team_number == 2) {
                        teamColor = 'green';
                    } else if (square.team_number == 3) {
                        teamColor = 'orange';
                    }
                    var classes = "game-square text-white " + teamColor + "-bg";
                    return <div className={classes}> {square.game_square_number + 1}</div>;
                }
            });
        })}
      </div>
      <div className="gameboard-col">
        {col4.map(function(number, index){
            return props.gameSquares.map(function(square, index){
                if (number - 1 == square.game_square_number) {
                    var teamColor = '';
                    if (square.team_number == 0) {
                        teamColor = 'red';
                    } else if (square.team_number == 1) {
                        teamColor = 'blue';
                    } else if (square.team_number == 2) {
                        teamColor = 'green';
                    } else if (square.team_number == 3) {
                        teamColor = 'orange';
                    }
                    var classes = "game-square text-white " + teamColor + "-bg";
                    return <div className={classes}> {square.game_square_number + 1}</div>;
                }
            });
        })}
      </div>
      <div className="gameboard-col">
        {col5.map(function(number, index){
            return props.gameSquares.map(function(square, index){
                if (number - 1 == square.game_square_number) {
                    var teamColor = '';
                    if (square.team_number == 0) {
                        teamColor = 'red';
                    } else if (square.team_number == 1) {
                        teamColor = 'blue';
                    } else if (square.team_number == 2) {
                        teamColor = 'green';
                    } else if (square.team_number == 3) {
                        teamColor = 'orange';
                    }
                    var classes = "game-square text-white " + teamColor + "-bg";
                    return <div className={classes}> {square.game_square_number + 1}</div>;
                }
            });
        })}
      </div>
      <div className="gameboard-col">
        {col6.map(function(number, index){
            return props.gameSquares.map(function(square, index){
                if (number - 1 == square.game_square_number) {
                    var teamColor = '';
                    if (square.team_number == 0) {
                        teamColor = 'red';
                    } else if (square.team_number == 1) {
                        teamColor = 'blue';
                    } else if (square.team_number == 2) {
                        teamColor = 'green';
                    } else if (square.team_number == 3) {
                        teamColor = 'orange';
                    }
                    var classes = "game-square text-white " + teamColor + "-bg";
                    return <div className={classes}> {square.game_square_number + 1}</div>;
                }
            });
        })}
      </div>
      <div className="gameboard-col">
        {col7.map(function(number, index){
            return props.gameSquares.map(function(square, index){
                if (number - 1 == square.game_square_number) {
                    var teamColor = '';
                    if (square.team_number == 0) {
                        teamColor = 'red';
                    } else if (square.team_number == 1) {
                        teamColor = 'blue';
                    } else if (square.team_number == 2) {
                        teamColor = 'green';
                    } else if (square.team_number == 3) {
                        teamColor = 'orange';
                    }
                    var classes = "game-square text-white " + teamColor + "-bg";
                    return <div className={classes}> {square.game_square_number + 1}</div>;
                }
            });
        })}
      </div>
      <div className="gameboard-col">
        {col8.map(function(number, index){
            return props.gameSquares.map(function(square, index){
                if (number - 1 == square.game_square_number) {
                    var teamColor = '';
                    if (square.team_number == 0) {
                        teamColor = 'red';
                    } else if (square.team_number == 1) {
                        teamColor = 'blue';
                    } else if (square.team_number == 2) {
                        teamColor = 'green';
                    } else if (square.team_number == 3) {
                        teamColor = 'orange';
                    }
                    var classes = "game-square text-white " + teamColor + "-bg";
                    return <div className={classes}> {square.game_square_number + 1}</div>;
                }
            });
        })}
      </div>
    </div>
  );
};
