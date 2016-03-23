'use strict';

const env = process.env;

module.exports = {
  clientID: env.appsetting_oauth_client_id,
  clientSecret: env.appsetting_oauth_client_secret,
  ngrokHostname: env.appsetting_ngrok_hostname,
  oneDriveRefreshToken: env.appsetting_onedrive_refresh_token,
  oneDriveRoot: env.appsetting_onedrive_root,
  redirectURL: env.appsetting_oauth_redirect_url,
  slackSlashToken: env.appsetting_slack_slash_token
};
