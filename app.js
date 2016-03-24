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
  COMMAND_PATTERN = /^(search(-raw)?)\s+(.*)/i,
  EXTENSION_COLOR = {
    '.docx': '#295391',
    '.doc': '#295391',
    '.xlsx': '#1F6B41',
    '.xls': '#1F6B41',
    '.pptx': '#C44423',
    '.ppt': '#C44423',
    '.one': '#783673',
    '.pdf': '#FB0200'
  },
  MAX_NUM_RESULT = 10,
  ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

let cachedAccessToken = {
  token: null,
  expiry: 0
}

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

  if (!config.slackSlashToken) {
    return res.status(200).send({ text: 'Missing environment variable "APPSETTING_SLACK_SLASH_TOKEN"' });
  } else if (body.token !== config.slackSlashToken) {
    return res.status(200).send({ text: 'Invalid Slack token received' });
  } else if (!config.oneDriveRefreshToken) {
    return res.status(200).send({ error: 'Missing environment variable "APPSETTING_ONEDRIVE_REFRESH_TOKEN"' });
  }

  var commandMatch = COMMAND_PATTERN.exec(body.text);

  if (!commandMatch) {
    return res.status(200).send({ text: 'Unknown command' });
  }

  const
    command = commandMatch[1],
    searchText = commandMatch[3];

  res.status(200).send({
    text: `Searching for documents containing "${searchText}"…`
  });

  exchangeAccessToken(config.oneDriveRefreshToken)
    .then(
      refreshToken => {
        const
          oneDriveRoot = config.oneDriveRoot,
          itemSpec = oneDriveRoot ? (':/' + encodeURI(config.oneDriveRoot) + ':') : '',
          url = `https://api.onedrive.com/v1.0/drive/root${itemSpec}/view.search?q=${encodeURIComponent(searchText)}&orderby=lastModifiedDateTime%20desc`;

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
            if (json.error) {
              return sendSlackResponse(responseURL, {
                text: `Failed to search documents due to "${json.error.message}"`
              });
            }

            if (command === 'search-raw') {
              sendSlackResponse(responseURL, {
                text: `\`\`\`${JSON.stringify(json, null, 2)}\`\`\``
              });
            } else if (!json.value.length) {
              sendSlackResponse(responseURL, {
                text: `We did not found any documents containing "${searchText}"`
              });
            } else {
              const numFound = json['@search.approximateCount'];

              let message;

              if (numFound > MAX_NUM_RESULT) {
                message = `We found ${numFound} documents containing "${searchText}", the first ${MAX_NUM_RESULT} are listed below`;
              } else if (numFound > 1) {
                message = `We found ${numFound} documents containing "${searchText}"`;
              } else {
                message = `We found one document containing "${searchText}"`;
              }

              sendSlackResponse(responseURL, {
                text: message,
                attachments: json.value.sort((x, y) => {
                  x = new Date(x.fileSystemInfo.lastModifiedDateTime).getTime();
                  y = new Date(y.fileSystemInfo.lastModifiedDateTime).getTime();

                  return y - x;
                }).reduce((result, json) => {
                  result.length < MAX_NUM_RESULT && result.push(json);

                  return result;
                }, []).map(json => {
                  let parentPath = decodeURI(json.parentReference.path.replace(/^\/drive\/root:\//, ''));

                  if (parentPath.substr(0, oneDriveRoot.length + 1) === oneDriveRoot + '/') {
                    parentPath = parentPath.substr(oneDriveRoot.length + 1);
                  }

                  const
                    extName = (/\..*$/.exec(json.name) || [])[0],
                    color = EXTENSION_COLOR[(extName || '').toLowerCase()] || '#CCC',
                    filename = `${parentPath}/${decodeURI(json.name)}`,
                    timeAgo = Date.now() - new Date(json.fileSystemInfo.lastModifiedDateTime).getTime();

                  return {
                    color: color,
                    fallback: filename,
                    mrkdwn_in: ['text', 'pretext'],
                    title: `:page_facing_up: ${filename}`,
                    title_link: json.webUrl,
                    text: `Located at <https://onedrive.live.com/redir?resid=${json.parentReference.id}|${parentPath}>\nLast modified ${time(timeAgo)} ago by ${(json.lastModifiedBy || json.createdBy || {}).user.displayName}`
                    // fields: [{
                    //   title: 'Size',
                    //   value: bytes(json.size),
                    //   short: true
                    // }, {
                    //   title: 'Last modified',
                    //   value: dateFormat(json.lastModifiedDateTime),
                    //   short: true
                    // }]
                  };
                })
              });
            }
          })
          .catch(err => sendSlackResponse(responseURL, { text: `Error: ${err.message || err.code || err}` }));
      },
      err => sendSlackResponse(responseURL, { text: `Failed to exchange refresh token\n\`\`\`${err}\`\`\`` })
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
  const now = Date.now();

  if (now < cachedAccessToken.expiry && cachedAccessToken.token) {
    return new Promise(resolve => resolve(cachedAccessToken.token));
  }

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
    .then(json => {
      const token = json.access_token;

      cachedAccessToken = {
        token,
        expiry: now + json.expires_in * 1000
      }

      return token;
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