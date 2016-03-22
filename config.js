'use strict';

module.exports = {
  clientID: process.env.oauth_client_id,
  clientSecret: process.env.oauth_client_secret,
  ngrokPort: process.env.appsetting_ngrok_port || 80
};
