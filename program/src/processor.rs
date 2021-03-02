
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
    util::{hash_value, get_slot_hash, unpack_mint},
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
            SixtyFourGameInstruction::Attack { amount, from_square, to_square } => {
                msg!("SixtyFourGameInstruction: Attack");
                Self::process_attack(accounts, amount, from_square, to_square, program_id)
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

        // Trasnfer bid amount to treasury - can refund if no nft given
        **treasury_account.lamports.borrow_mut() += amount;
        **treasury_fund_account.lamports.borrow_mut() -= amount;

        // Save a BidEntry into the auction list account
        let offset = (auction_info.bid_count * 48) as usize;
        let mut auction_list_info = BidEntry::unpack_unchecked(&auction_list_account.data.borrow()[offset..(offset + 48)])?;
        auction_list_info.bid_number = auction_info.bid_count;
        auction_list_info.amount_lamports = amount;
        auction_list_info.bidder_pubkey = *bidder_account.key;
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

            // Inititalize mint - program
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

            // Initialize token account
            let init_account_instr = spl_token::instruction::initialize_account(
                &spl_token::ID,
                token_account.key,
                mint_account.key,
                bid_entry_account.key,
            )?;
            let init_account_account_infos = &[
                token_account.clone(),
                mint_account.clone(),
                bid_entry_account.clone(),
                rent_account.clone()
            ];
            invoke_signed(
                &init_account_instr,
                init_account_account_infos,
                &[],
            )?;

            // Mint token to bidder
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

            // Increment squares minted - tracks current minting
            auction_info.squares_minted += 1;
            AuctionInfo::pack(auction_info, &mut auction_info_account.data.borrow_mut())?;

            // Prevent second mint
            offset = (highest_bid_bid_number * 48) as usize;
            let mut auction_list_info = BidEntry::unpack_unchecked(&auction_list_account.data.borrow()[offset..(offset + 48)])?;
            auction_list_info.amount_lamports = 0;
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
        let player_account = next_account_info(accounts_iter)?;
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

        // Confirm player is signer
        if !player_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

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
        invoke_signed(
            &init_account_instr,
            init_account_account_infos,
            &[],
        )?;

        // Transfer NFT from player to program
        let transfer_instr = spl_token::instruction::transfer(
            &spl_token::ID,
            game_square_token_account.key,
            program_token_account.key,
            player_account.key,
            &[&player_account.key],
            1,
        )?;
        let transfer_instr_account_infos = &[
            game_square_token_account.clone(),
            program_token_account.clone(),
            player_account.clone(),
            rent_account.clone()
        ];
        invoke_signed(
            &transfer_instr,
            transfer_instr_account_infos,
            &[],
        )?;

        // Save active player info - designated spot on list for each square
        let offset = (square * 72) as usize;
        let mut active_player_list_info = ActivePlayer::unpack_unchecked(&active_players_list_account.data.borrow()[offset..(offset + 72)])?;
        active_player_list_info.game_square_number = square;
        active_player_list_info.owner_pubkey = *player_account.key;
        active_player_list_info.program_token_account_pubkey = *program_token_account.key;
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
        amount: u64,
        from_square_index: u64,
        to_square_index: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {

        // Set accounts
        let accounts_iter = &mut accounts.iter();
        let attacker_owner_account = next_account_info(accounts_iter)?;
        let auction_info_account = next_account_info(accounts_iter)?;
        let sysvar_account = next_account_info(accounts_iter)?;
        let sysvar_slot_history = next_account_info(accounts_iter)?;
        let rent_account = next_account_info(accounts_iter)?;
        let spl_token_program = next_account_info(accounts_iter)?;
        let active_players_list_account = next_account_info(accounts_iter)?;
        let all_game_squares_list_account = next_account_info(accounts_iter)?;
        let treasury_account = next_account_info(accounts_iter)?;

        // Confirm attacker is signer
        if !attacker_owner_account.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Dont allow initiate play if before auction_info
        let current_slot = Clock::from_account_info(sysvar_account)?.slot;
        let mut auction_info = AuctionInfo::unpack_unchecked(&auction_info_account.data.borrow())?;
        if !auction_info.auction_enabled ||
            auction_info.auction_end_slot >= current_slot {
            msg!("Auction is active, cannot attack");
            return Err(ProgramError::InvalidAccountData);
        }

        // Confirm attacker can attack defender square
        let mut attackable = [[0u64; 4]; 64];
        attackable = [
            [2,4,6,8],
            [1,3,9,11],
            [2,4,12,14],
            [1,3,5,15],
            [4,6,16,18],
            [1,5,7,19],
            [6,8,20,22],
            [1,7,9,23],
            [2,8,10,24],
            [9,11,25,27],
            [2,10,12,28],
            [3,11,13,29],
            [12,14,30,32],
            [3,13,15,33],
            [4,14,16,34],
            [5,15,17,35],
            [16,18,36,38],
            [5,17,19,39],
            [6,18,20,40],
            [7,19,21,41],
            [20,22,42,44],
            [7,21,23,45],
            [8,22,24,46],
            [9,23,25,47],
            [10,24,26,48],
            [25,27,49,51],
            [10,26,28,52],
            [11,27,29,53],
            [12,28,30,54],
            [13,29,31,55],
            [32,30,56,58],
            [13,31,33,59],
            [14,32,34,60],
            [15,33,35,61],
            [16,34,36,62],
            [17,35,37,63],
            [36,38,64,0],
            [17,37,39,0],
            [18,38,40,0],
            [19,39,41,0],
            [20,40,42,0],
            [21,41,43,0],
            [42,44,0,0],
            [21,43,45,0],
            [22,44,46,0],
            [23,45,47,0],
            [24,46,48,0],
            [25,47,49,0],
            [26,48,50,0],
            [49,51,0,0],
            [26,50,52,0],
            [27,51,53,0],
            [28,52,54,0],
            [29,53,55,0],
            [30,54,56,0],
            [31,55,57,0],
            [56,58,0,0],
            [31,57,59,0],
            [32,58,60,0],
            [33,59,61,0],
            [34,60,62,0],
            [35,61,63,0],
            [36,62,64,0],
            [37,63,0,0]
        ];
        let mut can_attack = false;
        for (i, row) in attackable.iter().enumerate() {
            for (j, col) in row.iter().enumerate() {
                if i == from_square_index as usize && (*col - 1) == to_square_index {
                    msg!("You can attack!");
                    can_attack = true;
                    break;
                }
            }
        }
        if (!can_attack) {
            msg!("Unable to attack, attacker and defender are not neighbors");
            return Err(ProgramError::InvalidAccountData);  // TODO
        }

        // Get attacker/defender info
        let mut fromOffset = (from_square_index * 56) as usize;
        let mut attacker_info = GameSquare::unpack_unchecked(&all_game_squares_list_account.data.borrow()[fromOffset..(fromOffset + 56)])?;
        let mut toOffset = (to_square_index * 56) as usize;
        let mut defender_info = GameSquare::unpack_unchecked(&all_game_squares_list_account.data.borrow()[toOffset..(toOffset + 56)])?;

        // Confirm attacker is on a different team than defender
        if attacker_info.team_number == defender_info.team_number {
            msg!("Unable to attack, attacker and defender are on the same team");
            return Err(ProgramError::InvalidAccountData);  // TODO
        }

        // Set active player accounts
        let fromOffsetActive = (from_square_index * 72) as usize;
        let mut attacker_active_player_info = ActivePlayer::unpack_unchecked(&active_players_list_account.data.borrow()[fromOffsetActive..(fromOffsetActive + 72)])?;

        let toOffsetActive = (to_square_index * 72) as usize;
        let mut defender_active_player_info = ActivePlayer::unpack_unchecked(&active_players_list_account.data.borrow()[toOffsetActive..(toOffsetActive + 72)])?;

        // Confirm attacker matches attacker owner_pubkey
        if *attacker_owner_account.key != attacker_active_player_info.owner_pubkey {
            msg!("Unable to attack, transaction signer does not match attacker");
            return Err(ProgramError::InvalidAccountData);  // TODO
        }

        // Confirm attacker is active
        if attacker_active_player_info.game_square_number != from_square_index {
            msg!("Unable to attack, attacker is not active");
            return Err(ProgramError::InvalidAccountData);  // TODO
        }
        // Confirm defender is active
        if defender_active_player_info.game_square_number != to_square_index {
            msg!("Unable to attack, defender is not active");
            return Err(ProgramError::InvalidAccountData);  // TODO
        }

        // Get the roll under value TODO: based on rank
        let advantage_percent = 4;
        let roll_under_64 = 51 + ((64 - attacker_info.game_square_number) * advantage_percent / 64) as u64;

        // Get result of attack (hash blockhash, get rand value from 1-100)
        let slot_hashes_data = sysvar_slot_history.try_borrow_data()?;
        let slot_hash = get_slot_hash(&slot_hashes_data, current_slot - 3);

        // Confirm account is slotHashes account & hash is not empty

        // Get roll result
        let val = hash_value(slot_hash);
        let result = (val % 100) + 1;

        // Log result
        let s: String = result.to_string();
        let ss: &str = &s;
        let un: String = roll_under_64.to_string();
        let uns: &str = &un;
        msg!("Rolling for a number under:");
        msg!(uns);
        msg!("You rolled a:");
        msg!(ss);

        // Decrease health of attacker or defender based on result
        if result >= roll_under_64 {
            msg!("You LOSE! Attacker loses health");

            // Check if health is going to go to 0, if so, update ActivePlayer ownerKey to
            // attacker and change the team
            if (attacker_info.health_number <= amount) {
                msg!("Attacker dies...");
                // reset health for new player
                attacker_info.health_number = 100000000;

                // Transfer ownership
                attacker_active_player_info.owner_pubkey = defender_active_player_info.owner_pubkey;
                attacker_active_player_info.program_token_account_pubkey = defender_active_player_info.program_token_account_pubkey;

                ActivePlayer::pack(attacker_active_player_info, &mut active_players_list_account.data.borrow_mut()[fromOffsetActive..(fromOffsetActive + 72)])?;

                // Transfer Team
                attacker_info.team_number = defender_info.team_number;

            } else {
                attacker_info.health_number -= amount;
            }

        } else {
            msg!("You WIN! Defender loses health");

            // Check if health is going to go to 0, if so, update ActivePlayer ownerKey to
            // attacker and change the team
            if (defender_info.health_number <= amount) {
                msg!("Defender dies...");
                // reset health for new player
                defender_info.health_number = 100000000;

                // Transfer ownership
                defender_active_player_info.owner_pubkey = attacker_active_player_info.owner_pubkey;
                defender_active_player_info.program_token_account_pubkey = attacker_active_player_info.program_token_account_pubkey;

                ActivePlayer::pack(defender_active_player_info, &mut active_players_list_account.data.borrow_mut()[toOffsetActive..(toOffsetActive + 72)])?;

                // Transfer Team
                defender_info.team_number = attacker_info.team_number;

            } else {
                defender_info.health_number -= amount;
            }

        }

        GameSquare::pack(attacker_info, &mut all_game_squares_list_account.data.borrow_mut()[fromOffset..(fromOffset + 56)])?;
        GameSquare::pack(defender_info, &mut all_game_squares_list_account.data.borrow_mut()[toOffset..(toOffset + 56)])?;

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
