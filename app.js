'use strict';

// console.log(JSON.stringify(process.env, null, 2));

const
  config = require('./config'),
  express = require('express'),
  fetch = require('node-fetch');

const
  app = express(),
  port = process.env.port || process.argv[2] || 80;

app.get('/oauth/config', (req, res) => {
  res.json({
    clientID: config.clientID,
    redirectURL: config.redirectURL
  });
});

// app.get('/oauth/redirect', (req, res) => {
//   const
//     query = {
//       client_id: config.clientID,
//       redirect_uri: config.redirectURL,
//       client_secret: config.clientSecret,
//       code: req.query.code,
//       grant_type: 'authorization_code'
//     },
//     queryString = Object.keys(query).map(name => {
//       return `${name}=${encodeURIComponent(query[name])}`;
//     }).join('&');

//   console.log(query);
//   console.log(queryString);

//   fetch(
//     'https://login.live.com/oauth20_token.srf',
//     {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded'
//       },
//       body: queryString
//     }
//   )
//     .then(res => res.json())
//     .then(json => {
//       res.send(json);
//     })
//     .catch(err => {
//       res.status(500).send('failed to exchange code for refresh token');
//     });
// });

app.use(express.static('html'));

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en-US">
      <head>
        <title></title>
      </head>
      <body>
        <script type="text/javascript">
        !function () {
          'use strict';

          window.location.replace(
            window.location.href.replace(
              /(https?:\\/\\/)[^\/]*(.*)/,
              '$1${config.ngrokHostname}$2'
            )
          );
        }();
        </script>
      </body>
    </html>
  `);
});

app.listen(process.env.port || process.argv[2] || 80, () => {
  console.log(`Listening to port ${port}`);
});
