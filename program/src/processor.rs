
use byteorder::{ByteOrder, BigEndian, LittleEndian};
use solana_sdk::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvar::{
        clock::Clock, slot_hashes::SlotHashes, Sysvar,
    },
};

use solana_sdk::program::invoke_signed;
// use spl_token::{instruction};
use solana_sdk::program_pack::Pack as TokenPack;
// use spl_token::state::{Account as TokenAccount, Mint};

use num_derive::FromPrimitive;
use solana_sdk::{decode_error::DecodeError};
use thiserror::Error;

use crate::{
    error::SixtyFourGameError,
    instruction::SixtyFourGameInstruction,
    state::{BidEntry, GameSquare},
};

pub struct Processor;
impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = SixtyFourGameInstruction::unpack(instruction_data)?;

        match instruction {
            SixtyFourGameInstruction::Bid { amount } => {
                msg!("SixtyFourGameInstruction: Bid");
                Self::process_bid(accounts, amount, program_id)
            }
            SixtyFourGameInstruction::CancelBid { } => {
                msg!("SixtyFourGameInstruction: CancelBid");
                Self::process_cancel_bid(accounts, program_id)
            }
            SixtyFourGameInstruction::MintNFT { bidEntryNumber } => {
                msg!("SixtyFourGameInstruction: MintNFT");
                Self::process_mint_nft(accounts, bidEntryNumber, program_id)
            }
            SixtyFourGameInstruction::InitiatePlay { square } => {
                msg!("SixtyFourGameInstruction: InitiatePlay");
                Self::process_initiate_play(accounts, square, program_id)
            }
            SixtyFourGameInstruction::EndPlay { square } => {
                msg!("SixtyFourGameInstruction: EndPlay");
                Self::process_end_play(accounts, square, program_id)
            }
            SixtyFourGameInstruction::Attack { fromSquare, toSquare } => {
                msg!("SixtyFourGameInstruction: Attack");
                Self::process_attack(accounts, fromSquare, toSquare, program_id)
            }
        }
    }

    pub fn process_bid(
        accounts: &[AccountInfo],
        amount: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        let samount = amount.to_string();
        let amount_str: &str = &samount;
        msg!("Bid Amount: ");
        msg!(amount_str);

        let accounts_iter = &mut accounts.iter();
        // Set accounts
        let bidder_account = next_account_info(accounts_iter)?;
        let auction_list_account = next_account_info(accounts_iter)?;
        let treasury_fund_account = next_account_info(accounts_iter)?;
        let treasury_account = next_account_info(accounts_iter)?;

        msg!("Transfering to treasury");

        **treasury_account.lamports.borrow_mut() += amount;
        **treasury_fund_account.lamports.borrow_mut() -= amount;

        // Save a BidEntry into the auction list account
        let mut auction_list_info = BidEntry::unpack_unchecked(&auction_list_account.data.borrow())?;

        msg!("Got auction list");

        auction_list_info.amount_lamports = amount;
        auction_list_info.bidder_pubkey = *bidder_account.key;

        msg!("Saving auction list");

        BidEntry::pack(auction_list_info, &mut auction_list_account.data.borrow_mut())?;

        msg!("Bid successful");
        Ok(())
    }

    pub fn process_cancel_bid(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
    ) -> ProgramResult {

        msg!("Cancel Bid successful");

        Ok(())
    }

    pub fn process_mint_nft(
        accounts: &[AccountInfo],
        bidEntryNumber: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        msg!("Mint NFT successful");

        Ok(())
    }

    pub fn process_initiate_play(
        accounts: &[AccountInfo],
        square: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        msg!("Initiate play successful");

        Ok(())
    }

    pub fn process_end_play(
        accounts: &[AccountInfo],
        square: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        msg!("Bid successful");

        Ok(())
    }

    pub fn process_attack(
        accounts: &[AccountInfo],
        fromSquare: u64,
        toSquare: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        msg!("Attack successful");

        Ok(())
    }

}


// Sanity tests
#[cfg(test)]
mod test {
    use super::*;
    use solana_sdk::clock::Epoch;

    #[test]
    fn test_sanity() {
        let program_id = Pubkey::default();
        let key = Pubkey::default();
        let mut lamports = 0;
        let mut data = vec![0; mem::size_of::<u64>()];
        LittleEndian::write_u64(&mut data, 0);
        let owner = Pubkey::default();
        let account = AccountInfo::new(
            &key,
            false,
            true,
            &mut lamports,
            &mut data,
            &owner,
            false,
            Epoch::default(),
        );
        let instruction_data: Vec<u8> = Vec::new();

        let accounts = vec![account];

        assert_eq!(LittleEndian::read_u64(&accounts[0].data.borrow()), 0);
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u64(&accounts[0].data.borrow()), 1);
        process_instruction(&program_id, &accounts, &instruction_data).unwrap();
        assert_eq!(LittleEndian::read_u64(&accounts[0].data.borrow()), 2);
    }
}

// Required to support msg! in tests
#[cfg(not(target_arch = "bpf"))]
solana_sdk::program_stubs!();
