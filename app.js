'use strict';

// console.log(JSON.stringify(process.env, null, 2));

const
  bytes = require('./number').bytes,
  config = require('./config'),
  dateFormat = require('dateformat'),
  express = require('express'),
  fetch = require('node-fetch'),
  time = require('./time').humanize;

const
  app = express(),
  port = process.env.port || process.argv[2] || 80;

const
  COMMAND_PATTERN = /^search\s+(.*)/i;

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

  if (body.token !== config.slackSlashToken) {
    return res.status(200).send({ text: 'Invalid Slack token' });
  } else if (!config.oneDriveRefreshToken) {
    return res.status(200).send({ error: 'Missing environment variable "APPSETTING_ONEDRIVE_REFRESH_TOKEN"' });
  }

  var commandMatch = COMMAND_PATTERN.exec(body.text);

  if (!commandMatch) {
    return res.status(200).send({ text: 'Unknown command' });
  }

  const searchText = commandMatch[1];

  res.status(204).send();

  exchangeAccessToken(config.oneDriveRefreshToken)
    .then(
      refreshToken => {
        const
          oneDriveRoot = config.oneDriveRoot,
          itemSpec = oneDriveRoot ? (':/' + encodeURI(config.oneDriveRoot) + ':') : '',
          url = `https://api.onedrive.com/v1.0/drive/root${itemSpec}/view.search?q=${encodeURIComponent(searchText)}&orderby=lastModifiedDateTime%20desc`;

        console.log(url);

        fetch(
          url,
          {
            headers: {
              authorization: `bearer ${refreshToken}`
            }
          }
        )
          .then(res => res.json())
          .then(json => {
            if (!json.value.length) {
              sendSlackResponse(responseURL, {
                text: `We cannot find any documents containing "${searchText}"`
              });
            } else {
              sendSlackResponse(responseURL, {
                text: `We found ${json['@search.approximateCount']} documents containing "${searchText}"`,
                attachments: json.value.sort((x, y) => {
                  x = new Date(x.lastModifiedDateTime).getTime();
                  y = new Date(y.lastModifiedDateTime).getTime();

                  return y - x;
                }).map(json => ({
                  color: '#094AB2',
                  fallback: json.name,
                  title: `:page_facing_up: ${json.name}`,
                  title_link: json.webUrl,
                  text: `Last modified ${time(Date.now() - new Date(json.lastModifiedDateTime).getTime())} ago by ${(json.lastModifiedBy || json.createdBy || {}).user.displayName}`
                  // fields: [{
                  //   title: 'Size',
                  //   value: bytes(json.size),
                  //   short: true
                  // }, {
                  //   title: 'Last modified',
                  //   value: dateFormat(json.lastModifiedDateTime),
                  //   short: true
                  // }]
                }))
              });
            }
          })
          .catch(err => {
            console.log(err);

            sendSlackResponse(responseURL, { text: `Error: ${err.message}` });
          });
      },
      err => {
        console.log(err);
        sendSlackResponse(responseURL, { text: `Failed to exchange refresh token\n\`\`\`${err}\`\`\`` });
      }
    );
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
    .then(json => json.refresh_token);
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
    .then(json => json.access_token);
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