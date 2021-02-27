
use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};
use solana_program::{
    program_pack::{IsInitialized, Pack, Sealed},
    program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    error::SixtyFourGameError,
};


pub struct BidEntry {
    pub bid_number: u64,
    pub amount_lamports: u64,
    pub bidder_pubkey: Pubkey,
}

pub struct AuctionInfo {
    pub bid_count: u64,
    pub squares_minted: u64,
    pub auction_end_slot: u64,
    pub auction_enabled: bool
}

pub struct GameSquare {
    pub game_square_number: u64,
    pub team_number: u64,
    pub health_number: u64,
    pub mint_pubkey: Pubkey,
}

impl Sealed for BidEntry {}
impl Sealed for AuctionInfo {}
impl Sealed for GameSquare {}

//
// pub struct AuctionList {
//     pub bid_entries: [BidEntry],
// }


impl Pack for GameSquare {
    const LEN: usize = 56;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {

        let src = array_ref![src, 0, GameSquare::LEN];
        let (
            game_square_number,
            team_number,
            health_number,
            mint_pubkey,
        ) = array_refs![src, 8, 8, 8, 32];

        Ok(GameSquare {
            game_square_number: u64::from_le_bytes(*game_square_number),
            team_number: u64::from_le_bytes(*team_number),
            health_number: u64::from_le_bytes(*health_number),
            mint_pubkey: Pubkey::new_from_array(*mint_pubkey),
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, GameSquare::LEN];
        let (
            game_square_number_dst,
            team_number_dst,
            health_number_dst,
            mint_pubkey_dst,
        ) = mut_array_refs![dst, 8, 8, 8, 32];

        let GameSquare {
            game_square_number,
            team_number,
            health_number,
            mint_pubkey,
        } = self;

        *game_square_number_dst = game_square_number.to_le_bytes();
        *team_number_dst = team_number.to_le_bytes();
        *health_number_dst = health_number.to_le_bytes();
        mint_pubkey_dst.copy_from_slice(mint_pubkey.as_ref());
    }
}

impl Pack for AuctionInfo {
    const LEN: usize = 25;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {

        let src = array_ref![src, 0, AuctionInfo::LEN];
        let (
            bid_count,
            squares_minted,
            auction_end_slot,
            auction_enabled
        ) = array_refs![src, 8, 8, 8, 1];
        let auction_enabled = match auction_enabled {
            [0] => false,
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };

        Ok(AuctionInfo {
            bid_count: u64::from_le_bytes(*bid_count),
            squares_minted: u64::from_le_bytes(*squares_minted),
            auction_end_slot: u64::from_le_bytes(*auction_end_slot),
            auction_enabled: auction_enabled,
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, AuctionInfo::LEN];
        let (
            bid_count_dst,
            squares_minted_dst,
            auction_end_slot_dst,
            auction_enabled_dst,
        ) = mut_array_refs![dst, 8, 8, 8, 1];

        let AuctionInfo {
            bid_count,
            squares_minted,
            auction_end_slot,
            auction_enabled
        } = self;

        *bid_count_dst = bid_count.to_le_bytes();
        *squares_minted_dst = squares_minted.to_le_bytes();
        *auction_end_slot_dst = auction_end_slot.to_le_bytes();
        auction_enabled_dst[0] = *auction_enabled as u8;
    }
}

impl Pack for BidEntry {
    const LEN: usize = 48;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        // let start = position * BidEntry::LEN;
        // let end = start + BidEntry::LEN;
        // let src = array_ref![src, start, end];

        let src = array_ref![src, 0, BidEntry::LEN];
        let (
            bid_number,
            amount_lamports,
            bidder_pubkey,
        ) = array_refs![src, 8, 8, 32];

        Ok(BidEntry {
            bid_number: u64::from_le_bytes(*bid_number),
            amount_lamports: u64::from_le_bytes(*amount_lamports),
            bidder_pubkey: Pubkey::new_from_array(*bidder_pubkey),
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, BidEntry::LEN];
        let (
            bid_number_dst,
            amount_lamports_dst,
            bidder_pubkey_dst,
        ) = mut_array_refs![dst, 8, 8, 32];

        let BidEntry {
            bid_number,
            amount_lamports,
            bidder_pubkey,
        } = self;

        *bid_number_dst = bid_number.to_le_bytes();
        *amount_lamports_dst = amount_lamports.to_le_bytes();
        bidder_pubkey_dst.copy_from_slice(bidder_pubkey.as_ref());
    }
}
