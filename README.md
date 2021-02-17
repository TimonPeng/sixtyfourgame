# Sixty Four Game

[https://www.sixtyfourgame.com](https://www.sixtyfourgame.com)

- Game board consists of 64 squares
- 4 teams (16 sq/team initially) - Red, Blue, Green & Orange
- Owners of squares can battle neighbouring squares
- If the attacker wins, they are transferred ownership of the losing square NFT,
and the losing square now joins the attacking team
- If the attacker loses, vice versa^
- Players get 3 lives before NFT transfer
- After square is transferred to new team, gets 3 lives restored
- Once any team acquires all squares: ALL funds from auction are shared evenly across all owners of remaining squares

![Sixty Four Game Board](64board.png?raw=true "Sixty Four Game Board")

# Auction
Game board squares will be distributed in an auction, where the 64 highest bidders receive the NFT tokens. Higher ranking is more valuable, due to the game play advantage they have.

# Game Play
Players can battle neighboring squares. Each square has an associated rank/location on the game board. When one square attacks another, the program randomly determines a number: if the number returned is below a certain defeat-threshold, the defender player loses 1 life. If above the defeat-threshold, the attacker loses 1 life.

# Goal
Claim all squares of the game - 64 owners of the winning team are returned deposited SOL from auction.

# Marketplace
Players can sell their game square NFTs in the marketplace for SOL


# SFG Program Instructions:
```
SFGInstruction::Bid(amount, ownerKey)
Creates a BidEntry into the AuctionList (SOL lamports amount, pub key)  
Can only be done by ownerKey
Can only be done if before auction_end_block_number
Use PDA for holding SOL funds

SFGInstruction::CancelBid(ownerKey)
Cancels a BidEntry in the AuctionList
Can only be done by ownerKey
Can only be done if before auction_end_block_number
Send back SOL funds

SFGInstruction::MintNFT(bidEntryNumber)
Mints NFT for a BidEntry, sends SOL to Treasury
Can only be done if auction_end_block_number is passed
Can only be done by admin owner


SFGInstruction::InitiatePlay(square)
Deposit NFT to initiate play
Can only be done by square owner
Once complete, play is enabled - owner can attack or get attacked


SFGInstruction::EndPlay(fromSquare, toSquare)
Withdraw NFT from play
Can only be done by square owner
Once complete, play is disabled - owner cannot attack or get attacked


SFGInstruction::Attack(fromSquare, toSquare)
Attacks neighboring square
Can only be done by fromSquare owner
If a square loses all lives, transfer ownership of NFT to attacker

```
