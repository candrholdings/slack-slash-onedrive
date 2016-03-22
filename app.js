'use strict';

console.log(JSON.stringify(process.env, null, 2));

const express = require('express');

const
  app = express(),
  port = process.env.port || process.argv[2] || 80;

app.use(express.static('html'));

app.get('/api/ngrokport', (req, res) => {
  res.json({
    port: process.env.APPSETTING_NGROK_PORT
  });
});

app.listen(process.env.port || process.argv[2] || 80, () => {
  console.log(`Listening to port ${port}`);
});
