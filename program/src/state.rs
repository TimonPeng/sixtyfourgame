
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
    pub amount_lamports: u64,
    pub bidder_pubkey: Pubkey,
}

pub struct AuctionEndSlot {
    pub auction_end_slot: u64,
    pub auction_enabled: bool
}

impl Sealed for BidEntry {}
impl Sealed for AuctionEndSlot {}

//
// pub struct AuctionList {
//     pub bid_entries: [BidEntry],
// }

pub struct GameSquare {
    pub game_square_number: u8,
    pub team_number: u8,
    pub health_number: u8,
    pub assigned_pubkey: Pubkey,
}


impl Pack for AuctionEndSlot {
    const LEN: usize = 9;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {

        let src = array_ref![src, 0, AuctionEndSlot::LEN];
        let (
            auction_end_slot,
            auction_enabled
        ) = array_refs![src, 8, 1];
        let auction_enabled = match auction_enabled {
            [0] => false,
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };

        Ok(AuctionEndSlot {
            auction_end_slot: u64::from_le_bytes(*auction_end_slot),
            auction_enabled: auction_enabled,
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, AuctionEndSlot::LEN];
        let (
            auction_end_slot_dst,
            auction_enabled_dst,
        ) = mut_array_refs![dst, 8, 1];

        let AuctionEndSlot {
            auction_end_slot,
            auction_enabled
        } = self;

        *auction_end_slot_dst = auction_end_slot.to_le_bytes();
        auction_enabled_dst[0] = *auction_enabled as u8;
    }
}

impl Pack for BidEntry {
    const LEN: usize = 40;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        // let start = position * BidEntry::LEN;
        // let end = start + BidEntry::LEN;
        // let src = array_ref![src, start, end];

        let src = array_ref![src, 0, BidEntry::LEN];
        let (
            amount_lamports,
            bidder_pubkey,
        ) = array_refs![src, 8, 32];

        Ok(BidEntry {
            amount_lamports: u64::from_le_bytes(*amount_lamports),
            bidder_pubkey: Pubkey::new_from_array(*bidder_pubkey),
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, BidEntry::LEN];
        let (
            amount_lamports_dst,
            bidder_pubkey_dst,
        ) = mut_array_refs![dst, 8, 32];

        let BidEntry {
            amount_lamports,
            bidder_pubkey,
        } = self;

        *amount_lamports_dst = amount_lamports.to_le_bytes();
        bidder_pubkey_dst.copy_from_slice(bidder_pubkey.as_ref());
    }
}
