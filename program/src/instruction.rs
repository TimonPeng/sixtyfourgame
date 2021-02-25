use std::convert::TryInto;
use solana_sdk::{
    program_error::ProgramError,
};
use crate::error::SixtyFourGameError::InvalidInstruction;


pub enum SixtyFourGameInstruction {

    /// InititateAuction - auction_end_slot - sets the auction end slot
    InititateAuction {
        auction_end_slot: u64
    },
    /// Bid - amount  - adds BidEntry to AuctionList
    Bid {
        amount: u64,
    },
    /// CancelBid - removes BidEntry from AuctionList
    CancelBid {
    },
    /// MintNFT - bidEntryNumber - creates NFT after auction
    MintNFT {
        bidEntryNumber: u64
    },
    /// InitiatePlay - square - allows player to attack
    InitiatePlay {
        square: u64,
    },
    /// EndPlay - square - withdraws NFT to owner (can't attack)
    EndPlay {
        square: u64,
    },
    /// Attack - from/to squares - attacks neighboring square
    Attack {
        fromSquare: u64,
        toSquare: u64,
    },
}

impl SixtyFourGameInstruction {
    /// Unpacks a byte buffer into a SixtyFourGameInstruction
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

        Ok(match tag {
            0 => Self::InititateAuction {
                auction_end_slot: Self::unpack_amount(rest)?,
            },
            1 => Self::Bid {
                amount: Self::unpack_amount(rest)?,
            },
            2 => Self::CancelBid {},
            3 => Self::MintNFT {
                bidEntryNumber: Self::unpack_amount(rest)?,
            },
            4 => Self::InitiatePlay {
                square: Self::unpack_amount(rest)?,
            },
            5 => Self::EndPlay {
                square: Self::unpack_amount(rest)?,
            },
            6 => Self::Attack {
                fromSquare: Self::unpack_amount(rest)?,
                toSquare: Self::unpack_amount(rest)?,
            },
            _ => return Err(InvalidInstruction.into()),
        })
    }

    fn unpack_amount(input: &[u8]) -> Result<u64, ProgramError> {
        let amount = input
            .get(..8)
            .and_then(|slice| slice.try_into().ok())
            .map(u64::from_le_bytes)
            .ok_or(InvalidInstruction)?;
        Ok(amount)
    }

    fn unpack_amount_32(input: &[u8]) -> Result<u32, ProgramError> {
        let amount = input
            .get(..4)
            .and_then(|slice| slice.try_into().ok())
            .map(u32::from_le_bytes)
            .ok_or(InvalidInstruction)?;
        Ok(amount)
    }
}
