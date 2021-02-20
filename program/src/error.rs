
use thiserror::Error;
use num_derive::FromPrimitive;
use solana_sdk::{decode_error::DecodeError};
use solana_sdk::{
    program_error::ProgramError,
};

/// Errors that may be returned by SixtyFourGame
#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum SixtyFourGameError {
    /// Invalid instruction number passed in.
    #[error("Invalid instruction")]
    InvalidInstruction,
    /// The deserialization of the account returned something besides State::Mint.
    #[error("Deserialized account is not an SPL Token mint")]
    ExpectedMint,
}

impl From<SixtyFourGameError> for ProgramError {
    fn from(e: SixtyFourGameError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

impl<T> DecodeError<T> for SixtyFourGameError {
    fn type_of() -> &'static str {
        "SixtyFourGame Error"
    }
}
