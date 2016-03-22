'use strict';

module.exports = {
  clientID: process.env.appsetting_oauth_client_id,
  clientSecret: process.env.appsetting_oauth_client_secret,
  ngrokHostname: process.env.appsetting_ngrok_hostname,
  redirectURL: process.env.appsetting_oauth_redirect_url
};
