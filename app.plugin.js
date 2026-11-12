const { withAndroidManifest } = require('expo/config-plugins');
module.exports = config => withAndroidManifest(config, result => {
  // Local classroom server over Wi-Fi. Use HTTPS when deploying a public backend.
  const application = result.modResults.manifest.application[0];
  application.$['android:usesCleartextTraffic'] = 'true';
  return result;
});
