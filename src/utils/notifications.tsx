import React from "react";
import { notification } from "antd";
// import Link from '../components/Link';
import { Anchor } from 'antd';
const { Link } = Anchor;

export function notify({
  message = "",
  description = undefined as any,
  txid = "",
  type = "info",
  placement = "bottomLeft",
}) {
  if (txid) {
    description = <Anchor className="white-bg text-black"><Link className="white-bg text-black" href={'https://explorer.solana.com/tx/' + txid + "?cluster=testnet"} title="VIEW TRANSACTION" /></Anchor>;
  }
  (notification as any)[type]({
    message: <span style={{ color: "black" }}>{message}</span>,
    description: (
      <span style={{ color: "black", opacity: 0.5 }}>{description}</span>
    ),
    placement,
    style: {
      backgroundColor: "white",
    },
  });
}
