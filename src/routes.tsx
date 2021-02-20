import { HashRouter, Route, Switch } from "react-router-dom";
import React from "react";
import { WalletProvider } from "./contexts/wallet";
import { ConnectionProvider } from "./contexts/connection";
import { AccountsProvider } from "./contexts/accounts";
import { MarketProvider } from "./contexts/market";
import { AppLayout } from "./components/Layout";

import {
  AuctionView,
  GameBoardView,
  MarketplaceView,
  FaucetView,
  HomeView
} from "./views";

export function Routes() {
  return (
    <>
      <HashRouter basename={"/"}>
        <ConnectionProvider>
          <WalletProvider>
            <AccountsProvider>
              <MarketProvider>
                <AppLayout>
                  <Switch>
                    <Route exact path="/" component={() => <HomeView />} />
                    <Route exact path="/auction" children={<AuctionView />} />
                    <Route exact path="/gameboard" children={<GameBoardView />} />
                    <Route exact path="/marketplace" children={<MarketplaceView />} />
                    <Route exact path="/faucet" children={<FaucetView />} />
                  </Switch>
                </AppLayout>
              </MarketProvider>
            </AccountsProvider>
          </WalletProvider>
        </ConnectionProvider>
      </HashRouter>
    </>
  );
}
