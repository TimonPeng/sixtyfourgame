
use byteorder::{ByteOrder, BigEndian, LittleEndian};
use solana_sdk::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{
        rent::Rent, clock::Clock, slot_hashes::SlotHashes, Sysvar,
    },
    program_option::COption,
};

use solana_sdk::program::invoke_signed;
// use spl_token::{instruction};
use solana_sdk::program_pack::Pack as TokenPack;
use spl_token::state::{Account as TokenAccount, Mint};
use spl_token::{self, instruction::{initialize_mint, initialize_account, mint_to}};

use num_derive::FromPrimitive;
use solana_sdk::{decode_error::DecodeError};
use thiserror::Error;

use crate::{
    error::SixtyFourGameError,
    instruction::SixtyFourGameInstruction,
    state::{BidEntry, AuctionEndSlot, GameSquare},
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
            SixtyFourGameInstruction::InititateAuction { auction_end_slot } => {
                msg!("SixtyFourGameInstruction: InititateAuction");
                Self::process_auction_end_slot(accounts, auction_end_slot, program_id)
            }
            SixtyFourGameInstruction::Bid { amount } => {
                msg!("SixtyFourGameInstruction: Bid");
                Self::process_bid(accounts, amount, program_id)
            }
            SixtyFourGameInstruction::CancelBid { } => {
                msg!("SixtyFourGameInstruction: CancelBid");
                Self::process_cancel_bid(accounts, program_id)
            }
            SixtyFourGameInstruction::MintNFT {  } => {
                msg!("SixtyFourGameInstruction: MintNFT");
                Self::process_mint_nft(accounts, program_id)
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

    pub fn process_auction_end_slot(
        accounts: &[AccountInfo],
        auction_end_slot: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        let sauction_end_slot = auction_end_slot.to_string();
        let auction_end_slot_str: &str = &sauction_end_slot;
        msg!("Setting Auction End Slot to:");
        msg!(auction_end_slot_str);

        let accounts_iter = &mut accounts.iter();

        // Set accounts
        let admin_account = next_account_info(accounts_iter)?;
        let auction_end_slot_account = next_account_info(accounts_iter)?;

        // Save a BidEntry into the auction list account
        let mut auction_end_slot_info = AuctionEndSlot::unpack_unchecked(&auction_end_slot_account.data.borrow())?;

        // TODO; admin only
        if auction_end_slot_info.auction_enabled {
            msg!("Auction already started");
            return Err(ProgramError::InvalidAccountData);
        }

        auction_end_slot_info.auction_end_slot = auction_end_slot;
        auction_end_slot_info.auction_enabled = true;

        msg!("Saving auction end slot");

        AuctionEndSlot::pack(auction_end_slot_info, &mut auction_end_slot_account.data.borrow_mut())?;

        msg!("AuctionEndSlot successful");
        Ok(())
    }

    pub fn process_bid(
        accounts: &[AccountInfo],
        amount: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        let accounts_iter = &mut accounts.iter();
        // Set accounts
        let bidder_account = next_account_info(accounts_iter)?;
        let auction_list_account = next_account_info(accounts_iter)?;
        let treasury_fund_account = next_account_info(accounts_iter)?;
        let treasury_account = next_account_info(accounts_iter)?;
        let auction_end_slot_account = next_account_info(accounts_iter)?;
        let sysvar_account = next_account_info(accounts_iter)?;

        // Dont allow bidding if after auction_end_slot
        let current_slot = Clock::from_account_info(sysvar_account)?.slot;
        let mut auction_end_slot_info = AuctionEndSlot::unpack_unchecked(&auction_end_slot_account.data.borrow())?;
        if !auction_end_slot_info.auction_enabled || auction_end_slot_info.auction_end_slot < current_slot {
            msg!("Auction is not active");
            return Err(ProgramError::InvalidAccountData);
        }

        **treasury_account.lamports.borrow_mut() += amount;
        **treasury_fund_account.lamports.borrow_mut() -= amount;

        // Save a BidEntry into the auction list account
        let mut auction_list_info = BidEntry::unpack_unchecked(&auction_list_account.data.borrow())?;

        auction_list_info.amount_lamports = amount;
        auction_list_info.bidder_pubkey = *bidder_account.key;

        BidEntry::pack(auction_list_info, &mut auction_list_account.data.borrow_mut())?;

        msg!("Bid successful");
        Ok(())
    }

    pub fn process_cancel_bid(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
    ) -> ProgramResult {

        msg!("Cancel Bid successful");

        // TODO

        Ok(())
    }

    pub fn process_mint_nft(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
    ) -> ProgramResult {

        let accounts_iter = &mut accounts.iter();
        // Set accounts
        let payer_account = next_account_info(accounts_iter)?;
        let auction_list_account = next_account_info(accounts_iter)?;
        let auction_end_slot_account = next_account_info(accounts_iter)?;
        let sysvar_account = next_account_info(accounts_iter)?;
        let mint_account = next_account_info(accounts_iter)?;
        let token_account = next_account_info(accounts_iter)?;
        let mint_pda_account = next_account_info(accounts_iter)?;
        let rent_account = next_account_info(accounts_iter)?;
        // let rent = &Rent::from_account_info(next_account_info(accounts_iter)?)?;
        let spl_token_program = next_account_info(accounts_iter)?;

        // Dont allow minting if before auction_end_slot
        let current_slot = Clock::from_account_info(sysvar_account)?.slot;
        let mut auction_end_slot_info = AuctionEndSlot::unpack_unchecked(&auction_end_slot_account.data.borrow())?;
        if !auction_end_slot_info.auction_enabled || auction_end_slot_info.auction_end_slot >= current_slot {
            msg!("Auction is active, cannot mint");
            return Err(ProgramError::InvalidAccountData);
        }

        let mint_instr = spl_token::instruction::initialize_mint(
            &spl_token::ID,
            mint_account.key,
            mint_pda_account.key,
            Option::Some(mint_pda_account.key),
            0
        )?;

        let account_infos = &[
            mint_account.clone(),
            spl_token_program.clone(),
            rent_account.clone(),
            mint_pda_account.clone()
        ];

        invoke_signed(
            &mint_instr,
            account_infos,
            &[],
        )?;
        msg!("InitMint successful");

        let init_account_instr = spl_token::instruction::initialize_account(
            &spl_token::ID,
            token_account.key,
            mint_account.key,
            payer_account.key,
        )?;

        let init_account_account_infos = &[
            token_account.clone(),
            mint_account.clone(),
            payer_account.clone(),
            rent_account.clone()
        ];

        msg!("Initializing token account");

        invoke_signed(
            &init_account_instr,
            init_account_account_infos,
            &[],
        )?;

        let (mint_address, mint_bump_seed) = Pubkey::find_program_address(&[b"mint"], &program_id);

        let mint_to_instr = spl_token::instruction::mint_to(
            &spl_token::ID,
            mint_account.key,
            token_account.key,
            mint_pda_account.key,
            &[],
            1,
        )?;

        let account_infos = &[
            mint_account.clone(),
            token_account.clone(),
            spl_token_program.clone(),
            mint_pda_account.clone()
        ];

        let mint_signer_seeds: &[&[_]] = &[
            b"mint",
            &[mint_bump_seed],
        ];

        msg!("Minting");

        invoke_signed(
            &mint_to_instr,
            account_infos,
            &[&mint_signer_seeds],
        )?;

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
