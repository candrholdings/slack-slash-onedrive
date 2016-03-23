'use strict';

// console.log(JSON.stringify(process.env, null, 2));

const
  config = require('./config'),
  express = require('express'),
  fetch = require('node-fetch');

const
  app = express(),
  port = process.env.port || process.argv[2] || 80;

app.use(require('body-parser').urlencoded({ extended: false, inflate: false }));

app.get('/oauth/config', (req, res) => {
  res.json({
    clientID: config.clientID,
    redirectURL: config.redirectURL
  });
});

app.get('/oauth/redirect', (req, res) => {
  redeemCode(req.query.code)
    .then(
      refreshToken => res.json({ refreshToken }),
      err => res.status(500).send('failed to exchange code for refresh token')
    );
});

app.post('/slash', (req, res) => {
  const
    body = req.body,
    responseURL = body.response_url;

  console.log(req.body);

  if (req.body.token !== config.slackSlashToken) {
    return res.status(400).send();
  } else if (!config.oneDriveRefreshToken) {
    return res.status(400).send({ error: 'missing APPSETTING_ONEDRIVE_REFRESH_TOKEN' });
  }

  res.status(204).send();

  exchangeAccessToken(config.oneDriveRefreshToken)
    .then(refreshToken => {
      console.log(`https://api.onedrive.com/v1.0/drive/root:/${config.oneDriveRoot}:/view.search?q=${encodeURIComponent('ilas')}`);

      fetch(
        // `https://api.onedrive.com/v1.0/drive/root/view.search?q=${encodeURIComponent('ilas')}`,
        `https://api.onedrive.com/v1.0/drive/root:/${encodeURI('Documents')}:/view.search?q=${encodeURIComponent('ilas')}`,
        {
          headers: {
            authorization: `bearer ${refreshToken}`
          }
        }
      )
        .then(res => res.json())
        .then(json => {
          console.log(json);

          sendSlackResponse(responseURL, {
            text: '```' + JSON.stringify(json, null, 2) + '```'
          });
        })
        .catch(err => {
          console.log(err);

          sendSlackResponse(responseURL, { text: `Error: ${err.message}` });
        });
    });
});

function sendSlackResponse(responseURL, content) {
  return fetch(responseURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(content)
  })
}

function redeemCode(code) {
  return fetch(
    'https://login.live.com/oauth20_token.srf',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: toQueryString({
        client_id: config.clientID,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectURL
      })
    }
  )
    .then(res => res.json())
    .then(json => json.refresh_token)
    .catch(err => {
      res.status(500).send('failed to redeem code for refresh token');
    });
}

function exchangeAccessToken(refreshToken) {
  return fetch(
    'https://login.live.com/oauth20_token.srf',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: toQueryString({
        client_id: config.clientID,
        redirect_uri: config.redirectURL,
        client_secret: config.clientSecret,
        refresh_token: config.oneDriveRefreshToken,
        grant_type: 'refresh_token'
      })
    }
  )
    .then(res => res.json())
    .then(json => json.access_token)
    .catch(err => {
      res.status(500).send('failed to exchange refresh token for access token');
    });
}

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
              /^https?:\\/\\/[^\/]*(.*)/,
              '${config.ngrokHostname}$1'
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

function toQueryString(query) {
  return Object.keys(query).map(name => {
    return `${name}=${encodeURIComponent(query[name])}`;
  }).join('&');
}