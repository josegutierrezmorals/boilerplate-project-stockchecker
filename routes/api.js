'use strict';
const fetch = require('node-fetch');
const crypto = require('crypto');
const mongoose = require('mongoose');

mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGO_URI).catch(err => console.error('MongoDB error:', err));

const stockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  likes: { type: [String], default: [] },
});
const Stock = mongoose.model('Stock', stockSchema);

function anonymizeIP(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

async function getPrice(symbol) {
  const url = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${symbol}/quote`;
  const res = await fetch(url);
  const data = await res.json();
  return data.latestPrice || data.close || 0;
}

module.exports = function (app) {
  app.route('/api/stock-prices')
    .get(async function (req, res) {
      try {
        const like = req.query.like === 'true';
        const ip = anonymizeIP(req.ip);

        if (Array.isArray(req.query.stock)) {
          const [sym1, sym2] = req.query.stock.map(s =>
