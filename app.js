'use strict';

// console.log(JSON.stringify(process.env, null, 2));

const
  config = require('./config'),
  express = require('express');

const
  app = express(),
  port = process.env.port || process.argv[2] || 80;

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
              /(https?:\/\/)[^\/]*(.*)/,
              '$10.tcp.ngrok.io:${config.ngrokPort}$2'
            )
          );
        }();
        </script>
      </body>
    </html>
  `);
});

app.get('/api/ngrokport', (req, res) => {
  res.json({
    port: process.env.APPSETTING_NGROK_PORT
  });
});

app.listen(process.env.port || process.argv[2] || 80, () => {
  console.log(`Listening to port ${port}`);
});
