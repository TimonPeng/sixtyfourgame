const mongoose = require('mongoose');
const Schema = mongoose.Schema;

//create schema for markets
const MarketSchema = new Schema({
  gameSquareNumber: {
    type: Number,
    unique : true,
    required: [true, 'The gameSquareNumber is required']
  },
  marketId: {
    type: String,
    unique : true,
    required: [true, 'The marketId text field is required']
  },
  baseMintId: {
    type: String,
    unique : true,
    required: [true, 'The baseMintId text field is required']
  },
})

//create model for Market
const Market = mongoose.model('market', MarketSchema);

module.exports = Market;
