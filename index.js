// index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const jsonDiff = require('json-diff');
// Using request-promise for cleaner HTTP requests.
// Make sure to add 'request' and 'request-promise' to your package.json
const rp = require('request-promise');

// Initialize the Firebase Admin SDK
admin.initializeApp();

/**
 * Fetches a Remote Config template for a specific version using the REST API.
 * @param {string} version The version number of the template to retrieve.
 * @param {string} accessToken An OAuth2 access token for authentication.
 * @returns {Promise<object>} A promise that resolves to the Remote Config template.
 */
function getTemplate(version, accessToken) {
  // Get the project ID from the environment variables, which is automatically
  // set in the Cloud Functions runtime.
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) {
    throw new Error('Google Cloud Project ID not found in environment variables.');
  }

  const options = {
    uri: `https://firebaseremoteconfig.googleapis.com/v1/projects/${projectId}/remoteConfig`,
    qs: {
      versionNumber: version,
    },
    headers: {
      'Authorization': 'Bearer ' + accessToken,
    },
    json: true, // Automatically parses the JSON response body
  };

  return rp(options);
}

exports.showConfigDiff = functions.remoteConfig.onUpdate(versionMetadata => {
  return admin.credential.applicationDefault().getAccessToken()
    .then(accessTokenObj => {
      // The access token is used to authenticate requests to the Remote Config API.
      return accessTokenObj.access_token;
    })
    .then(accessToken => {
      const currentVersion = versionMetadata.versionNumber;
      const templatePromises = [];

      // Fetch the current template
      templatePromises.push(getTemplate(currentVersion, accessToken));

      // Fetch the previous template, if it's not the first version.
      if (parseInt(currentVersion, 10) > 1) {
        const previousVersion = String(parseInt(currentVersion, 10) - 1);
        templatePromises.push(getTemplate(previousVersion, accessToken));
      } else {
        // If it's the first version, there's no previous template to compare.
        // We'll use an empty object as a placeholder.
        templatePromises.push(Promise.resolve({}));
      }

      return Promise.all(templatePromises);
    })
    .then(results => {
      const currentTemplate = results[0];
      const previousTemplate = results[1];

      // Create a string representation of the differences between the two templates.
      const diff = jsonDiff.diffString(previousTemplate, currentTemplate);

      // Log the diff to the Cloud Functions logs.
      functions.logger.log('Remote Config update detected. Difference:', diff);

      return null;
    }).catch(error => {
      // Log any errors that occur during the process.
      functions.logger.error('Error in showConfigDiff function:', error);
      return null;
    });
});
