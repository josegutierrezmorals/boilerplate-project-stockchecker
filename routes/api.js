'use strict';
const fetch = require('node-fetch');
const crypto = require('crypto');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const stockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  likes: { type: [String], default: [] }, // IPs anonimizadas
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
          // Dos stocks
          const [sym1, sym2] = req.query.stock.map(s => s.toUpperCase());

          const [price1, price2] = await Promise.all([getPrice(sym1), getPrice(sym2)]);

          let [stock1, stock2] = await Promise.all([
            Stock.findOneAndUpdate(
              { symbol: sym1 },
              { $setOnInsert: { symbol: sym1 } },
              { upsert: true, new: true }
            ),
            Stock.findOneAndUpdate(
              { symbol: sym2 },
              { $setOnInsert: { symbol: sym2 } },
              { upsert: true, new: true }
            ),
          ]);

          if (like) {
            if (!stock1.likes.includes(ip)) {
              stock1 = await Stock.findOneAndUpdate(
                { symbol: sym1 },
                { $addToSet: { likes: ip } },
                { new: true }
              );
            }
            if (!stock2.likes.includes(ip)) {
              stock2 = await Stock.findOneAndUpdate(
                { symbol: sym2 },
                { $addToSet: { likes: ip } },
                { new: true }
              );
            }
          }

          const rel1 = stock1.likes.length - stock2.likes.length;
          const rel2 = stock2.likes.length - stock1.likes.length;

          return res.json({
            stockData: [
              { stock: sym1, price: price1, rel_likes: rel1 },
              { stock: sym2, price: price2, rel_likes: rel2 },
            ],
          });

        } else {
          // Un solo stock
          const sym = req.query.stock.toUpperCase();
          const price = await getPrice(sym);

          let stock = await Stock.findOneAndUpdate(
            { symbol: sym },
            { $setOnInsert: { symbol: sym } },
            { upsert: true, new: true }
          );

          if (like && !stock.likes.includes(ip)) {
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
