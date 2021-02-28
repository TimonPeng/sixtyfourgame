
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
    state::{BidEntry, AuctionInfo, GameSquare, ActivePlayer},
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
                Self::process_initiate_auction(accounts, auction_end_slot, program_id)
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

    pub fn process_initiate_auction(
        accounts: &[AccountInfo],
        auction_end_slot: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        let sauction_end_slot = auction_end_slot.to_string();
        let auction_end_slot_str: &str = &sauction_end_slot;
        msg!("Setting Auction End Slot to:");
        msg!(auction_end_slot_str);

        // Set accounts
        let accounts_iter = &mut accounts.iter();
        let admin_account = next_account_info(accounts_iter)?;
        let auction_info_account = next_account_info(accounts_iter)?;

        // Save a BidEntry into the auction list account
        let mut auction_info = AuctionInfo::unpack_unchecked(&auction_info_account.data.borrow())?;

        // TODO; admin only
        if auction_info.auction_enabled {
            msg!("Auction already started");
            return Err(ProgramError::InvalidAccountData);
        }

        auction_info.bid_count = 0;
        auction_info.squares_minted = 0;
        auction_info.auction_end_slot = auction_end_slot;
        auction_info.auction_enabled = true;

        msg!("Saving auction end slot");

        AuctionInfo::pack(auction_info, &mut auction_info_account.data.borrow_mut())?;

        msg!("InitAuction successful");
        Ok(())
    }

    pub fn process_bid(
        accounts: &[AccountInfo],
        amount: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        // Set accounts
        let accounts_iter = &mut accounts.iter();
        let bidder_account = next_account_info(accounts_iter)?;
        let auction_list_account = next_account_info(accounts_iter)?;
        let treasury_fund_account = next_account_info(accounts_iter)?;
        let treasury_account = next_account_info(accounts_iter)?;
        let auction_info_account = next_account_info(accounts_iter)?;
        let sysvar_account = next_account_info(accounts_iter)?;

        // Dont allow bidding if after auction_end_slot
        let max_bid_count = 1000;
        let current_slot = Clock::from_account_info(sysvar_account)?.slot;
        let mut auction_info = AuctionInfo::unpack_unchecked(&auction_info_account.data.borrow())?;
        if !auction_info.auction_enabled ||
            auction_info.auction_end_slot < current_slot ||
            auction_info.bid_count >= max_bid_count ||
            auction_info.squares_minted > 0 {
            msg!("Auction is not active or bids have reached capacity");
            return Err(ProgramError::InvalidAccountData); // TODO
        }

        msg!("Auction active");

        **treasury_account.lamports.borrow_mut() += amount;
        **treasury_fund_account.lamports.borrow_mut() -= amount;

        msg!("Lamports transfered");

        // Save a BidEntry into the auction list account
        let offset = (auction_info.bid_count * 48) as usize;
        let mut auction_list_info = BidEntry::unpack_unchecked(&auction_list_account.data.borrow()[offset..(offset + 48)])?;

        msg!("Setting data");

        auction_list_info.bid_number = auction_info.bid_count;
        auction_list_info.amount_lamports = amount;
        auction_list_info.bidder_pubkey = *bidder_account.key;

        msg!("Saving data");
        BidEntry::pack(auction_list_info, &mut auction_list_account.data.borrow_mut()[offset..(offset + 48)])?;

        // Increment bid counter
        auction_info.bid_count = auction_info.bid_count + 1;
        AuctionInfo::pack(auction_info, &mut auction_info_account.data.borrow_mut())?;

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
        let bid_entry_account = next_account_info(accounts_iter)?;
        let auction_list_account = next_account_info(accounts_iter)?;
        let auction_info_account = next_account_info(accounts_iter)?;
        let sysvar_account = next_account_info(accounts_iter)?;
        let mint_account = next_account_info(accounts_iter)?;
        let token_account = next_account_info(accounts_iter)?;
        let mint_pda_account = next_account_info(accounts_iter)?;
        let rent_account = next_account_info(accounts_iter)?;
        let spl_token_program = next_account_info(accounts_iter)?;
        let all_game_squares_list_account = next_account_info(accounts_iter)?;
        let treasury_account = next_account_info(accounts_iter)?;

        // Dont allow minting if before auction_info
        let current_slot = Clock::from_account_info(sysvar_account)?.slot;
        let mut auction_info = AuctionInfo::unpack_unchecked(&auction_info_account.data.borrow())?;
        if !auction_info.auction_enabled ||
            auction_info.auction_end_slot >= current_slot {
            msg!("Auction is active, cannot mint");
            return Err(ProgramError::InvalidAccountData);
        }

        let max_game_square_count = 64;
        if auction_info.squares_minted >= max_game_square_count {
            for i in 0..auction_info.bid_count {
                // Search for all bids from bid_entry_account
                let offset = (i * 48) as usize;
                let mut auction_list_info = BidEntry::unpack_unchecked(&auction_list_account.data.borrow()[offset..(offset + 48)])?;

                // REFUND USER
                if auction_list_info.bidder_pubkey == *bid_entry_account.key {
                    **treasury_account.lamports.borrow_mut() -= auction_list_info.amount_lamports;
                    **bid_entry_account.lamports.borrow_mut() += auction_list_info.amount_lamports;

                    // Zero out lamports so no duplicates
                    auction_list_info.amount_lamports = 0;
                    BidEntry::pack(auction_list_info, &mut auction_list_account.data.borrow_mut()[offset..(offset + 48)])?;
                }
            }
            msg!("Bid Refund successful");
        } else {

            // Max bid count tested at 1000 here, used 15k/20k TODO: improve this
            let mut highest_bid_amount_lamports = 0;
            let mut highest_bid_bid_number = 0;
            let mut highest_bidder_pubkey = *mint_pda_account.key; //placeholder, TODO:fix this
            for i in 0..auction_info.bid_count {

                // Fetch BidEntry to get highest
                let offset = (i * 48) as usize;
                let mut auction_list_info = BidEntry::unpack_unchecked(&auction_list_account.data.borrow()[offset..(offset + 48)])?;

                if highest_bid_amount_lamports < auction_list_info.amount_lamports {
                     highest_bid_amount_lamports = auction_list_info.amount_lamports;
                     highest_bidder_pubkey = auction_list_info.bidder_pubkey;
                     highest_bid_bid_number = auction_list_info.bid_number;
                }
            }

            if highest_bidder_pubkey != *bid_entry_account.key {
                msg!("Trying to MintNFT for account that is not the higest bidder");
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

            // Save a GameSquare into the all game squares list account
            let mut offset = (auction_info.squares_minted * 56) as usize;
            let mut all_game_squares_list_info = GameSquare::unpack_unchecked(&all_game_squares_list_account.data.borrow()[offset..(offset + 56)])?;

            let game_square_number = auction_info.squares_minted;
            all_game_squares_list_info.game_square_number = game_square_number;
            all_game_squares_list_info.team_number = game_square_number % 4;
            all_game_squares_list_info.health_number = 100000000;
            all_game_squares_list_info.mint_pubkey = *mint_account.key;

            GameSquare::pack(all_game_squares_list_info, &mut all_game_squares_list_account.data.borrow_mut()[offset..(offset + 56)])?;

            auction_info.squares_minted += 1;
            AuctionInfo::pack(auction_info, &mut auction_info_account.data.borrow_mut())?;

            // Prevent second mint
            offset = (highest_bid_bid_number * 48) as usize;
            let mut auction_list_info = BidEntry::unpack_unchecked(&auction_list_account.data.borrow()[offset..(offset + 48)])?;

            // Zero out lamports so no 2nd mint
            msg!("Zeroing data");
            auction_list_info.amount_lamports = 0;

            msg!("Saving data");
            BidEntry::pack(auction_list_info, &mut auction_list_account.data.borrow_mut()[offset..(offset + 48)])?;

            msg!("Mint NFT successful");
        }

        Ok(())
    }

    pub fn process_initiate_play(
        accounts: &[AccountInfo],
        square: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        let accounts_iter = &mut accounts.iter();
        // Set accounts
        let payer_account = next_account_info(accounts_iter)?;
        let game_square_token_account = next_account_info(accounts_iter)?;
        let auction_info_account = next_account_info(accounts_iter)?;
        let sysvar_account = next_account_info(accounts_iter)?;
        let mint_account = next_account_info(accounts_iter)?;
        let program_token_pda_account = next_account_info(accounts_iter)?;
        let program_token_account = next_account_info(accounts_iter)?;
        let rent_account = next_account_info(accounts_iter)?;
        let spl_token_program = next_account_info(accounts_iter)?;
        let active_players_list_account = next_account_info(accounts_iter)?;
        let treasury_account = next_account_info(accounts_iter)?;

        // Dont allow initiate play if before auction_info
        let current_slot = Clock::from_account_info(sysvar_account)?.slot;
        let mut auction_info = AuctionInfo::unpack_unchecked(&auction_info_account.data.borrow())?;
        if !auction_info.auction_enabled ||
            auction_info.auction_end_slot >= current_slot {
            msg!("Auction is active, cannot initiate play");
            return Err(ProgramError::InvalidAccountData);
        }


        // Confirm mint account is for the square given

        // Confirm mint is in the gameSquareList


        // Initialize program's token account
        let init_account_instr = spl_token::instruction::initialize_account(
            &spl_token::ID,
            program_token_account.key,
            mint_account.key,
            program_token_pda_account.key,
        )?;

        let init_account_account_infos = &[
            program_token_account.clone(),
            mint_account.clone(),
            program_token_pda_account.clone(),
            rent_account.clone()
        ];

        msg!("Initializing token account");

        invoke_signed(
            &init_account_instr,
            init_account_account_infos,
            &[],
        )?;

        // Transfer NFT from owner to program
        let transfer_instr = spl_token::instruction::transfer(
            &spl_token::ID,
            game_square_token_account.key,
            program_token_account.key,
            payer_account.key,
            &[&payer_account.key],
            1,
        )?;

        let transfer_instr_account_infos = &[
            game_square_token_account.clone(),
            program_token_account.clone(),
            payer_account.clone(),
            rent_account.clone()
        ];

        msg!("Transferring NFT to program");

        invoke_signed(
            &transfer_instr,
            transfer_instr_account_infos,
            &[],
        )?;

        // Save active player info - designated spot on list for each square
        let offset = (square * 72) as usize;
        let mut active_player_list_info = ActivePlayer::unpack_unchecked(&active_players_list_account.data.borrow()[offset..(offset + 72)])?;

        active_player_list_info.game_square_number = square;
        active_player_list_info.owner_pubkey = *payer_account.key; // owner must match
        active_player_list_info.program_token_account_pubkey = *program_token_account.key;

        // TODO: offset
        ActivePlayer::pack(active_player_list_info, &mut active_players_list_account.data.borrow_mut()[offset..(offset + 72)])?;

        msg!("Initiate Play / Deposit NFT successful");
        Ok(())
    }

    pub fn process_end_play(
        accounts: &[AccountInfo],
        square: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {



        // Transfer NFT from program to owner


        // Remove ownerKey from Active Players


        msg!("End Play / Withdraw NFT successful");
        Ok(())
    }

    pub fn process_attack(
        accounts: &[AccountInfo],
        fromSquare: u64,
        toSquare: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {


        // Confirm attacker can attack defender square


        // Confirm attacker is on a different team than defender


        // Get the roll under value based on rank


        // Get result of attack (hash blockhash, get rand value from 1-100)


        // Check if health is going to go to 0, if so, update ActivePlayer ownerKey to
        // attacker and change the team


        // Decrease health of attacker or defender based on result


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
