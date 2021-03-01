use std::convert::TryInto;
use solana_sdk::{
    program_error::ProgramError,
};
use crate::error::SixtyFourGameError::InvalidInstruction;
use solana_sdk::{
    msg,
};

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
    /// MintNFT - creates NFT after auction
    MintNFT {
    },
    /// InitiatePlay - square - allows player to attack
    InitiatePlay {
        square: u64,
    },
    /// EndPlay - square - withdraws NFT to owner (can't attack)
    EndPlay {
        square: u64,
    },
    /// Attack - amount and from/to squares - attacks neighboring square
    Attack {
        amount: u64,
        from_square: u64,
        to_square: u64,
    },
}

impl SixtyFourGameInstruction {
    /// Unpacks a byte buffer into a SixtyFourGameInstruction
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;
        Ok(match tag {
            0 => Self::InititateAuction {
                auction_end_slot: Self::unpack_amount(rest, 0)?,
            },
            1 => Self::Bid {
                amount: Self::unpack_amount(rest, 0)?,
            },
            2 => Self::CancelBid {},
            3 => Self::MintNFT {},
            4 => Self::InitiatePlay {
                square: Self::unpack_amount(rest, 0)?,
            },
            5 => Self::EndPlay {
                square: Self::unpack_amount(rest, 0)?,
            },
            6 => Self::Attack {
                amount: Self::unpack_amount(rest, 0)?,
                from_square: Self::unpack_amount(rest, 8)?,
                to_square: Self::unpack_amount(rest, 16)?,
            },
            _ => return Err(InvalidInstruction.into()),
        })
    }

    fn unpack_amount(input: &[u8], offet: usize) -> Result<u64, ProgramError> {
        let amount = input
            .get(offet..offet + 8)
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
