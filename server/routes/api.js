const express = require ('express');
const router = express.Router();
const Market = require('../models/market');

router.get('/markets', (req, res, next) => {
  Market.find({}, ['gameSquareNumber', 'marketId', 'baseMintId'])
    .sort([['gameSquareNumber', 1]])
    .then(data => res.json(data))
    .catch(next)
});

router.post('/market/create', (req, res, next) => {
  if(req.body.gameSquareNumber && req.body.marketId && req.body.baseMintId){
      Market.create(req.body)
        .then(data => res.json(data))
        .catch(next)
    }else {
      res.json({
        error: "The input field is empty or invalid"
      })
    }
});

module.exports = router;
