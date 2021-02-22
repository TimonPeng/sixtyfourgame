use solana_sdk::{
    pubkey::Pubkey,
};

pub struct BidEntry {
    pub amount_lamports: u64,
    pub bidder_pubkey: Pubkey,
}

pub struct AuctionList {
    pub bid_entries: [BidEntry],
}

pub struct GameSquare {
    pub game_square_number: u8,
    pub team_number: u8,
    pub health_number: u8,
    pub assigned_pubkey: Pubkey,
}
