'use strict';

const express = require('express');

const
  app = express(),
  port = process.env.port || process.argv[2] || 80;

app.use(express.static('html'));

app.get('/api/ngrokport', (req, res) => {
  res.json({
    port: process.env.APPSETTINGS_NGROK_PORT
  });
});

app.listen(process.env.port || process.argv[2] || 80, () => {
  console.log(`Listening to port ${port}`);
});
