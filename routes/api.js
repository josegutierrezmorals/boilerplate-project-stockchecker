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
          const sym1 = req.query.stock[0].toUpperCase();
          const sym2 = req.query.stock[1].toUpperCase();
          const price1 = await getPrice(sym1);
          const price2 = await getPrice(sym2);

          let stock1 = await Stock.findOneAndUpdate(
            { symbol: sym1 },
            { $setOnInsert: { symbol: sym1 } },
            { upsert: true, new: true }
          );
          let stock2 = await Stock.findOneAndUpdate(
            { symbol: sym2 },
            { $setOnInsert: { symbol: sym2 } },
            { upsert: true, new: true }
          );

          if (like) {
            stock1 = await Stock.findOneAndUpdate(
              { symbol: sym1 },
              { $addToSet: { likes: ip } },
              { new: true }
            );
            stock2 = await Stock.findOneAndUpdate(
              { symbol: sym2 },
              { $addToSet: { likes: ip } },
              { new: true }
            );
          }

          return res.json({
            stockData: [
              { stock: sym1, price: price1, rel_likes: stock1.likes.length - stock2.likes.length },
              { stock: sym2, price: price2, rel_likes: stock2.likes.length - stock1.likes.length },
            ],
          });

        } else {
          const sym = req.query.stock.toUpperCase();
          const price = await getPrice(sym);

          let stock = await Stock.findOneAndUpdate(
            { symbol: sym },
            { $setOnInsert: { symbol: sym } },
            { upsert: true, new: true }
          );

          if (like) {
            stock = await Stock.findOneAndUpdate(
              { symbol: sym },
              { $addToSet: { likes: ip } },
              { new: true }
            );
          }

          return res.json({
            stockData: {
              stock: sym,
              price: price,
              likes: stock.likes.length,
            },
          });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
      }
    });
};
