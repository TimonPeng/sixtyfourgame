
use solana_program::{
    program_pack::{IsInitialized, Pack, Sealed},
    program_error::ProgramError,
    pubkey::Pubkey,
};


pub struct BidEntry {
    pub amount_lamports: u64,
    pub bidder_pubkey: Pubkey,
}

impl Sealed for BidEntry {}

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

use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};

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
