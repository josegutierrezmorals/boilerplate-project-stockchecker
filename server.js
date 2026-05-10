'use strict';
require('dotenv').config();
const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const apiRoutes        = require('./routes/api.js');
const fccTestingRoutes = require('./routes/fcctesting.js');
const runner           = require('./test-runner');

const app = express();

app.use('/public', express.static(process.cwd() + '/public'));
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req, res, next) {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'");
  next();
});

app.route('/').get(function (req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

fccTestingRoutes(app);
apiRoutes(app);

app.use(function (req, res, next) {
  res.status(404).type('text').send('Not Found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log('Your app is listening on port ' + PORT);
  if (process.env.NODE_ENV === 'test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        console.log('Tests are not valid:');
        console.error(e);
      }
    }, 3500);
  }
});

module.exports = app;
