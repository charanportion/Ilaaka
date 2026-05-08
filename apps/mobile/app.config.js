// Dynamic config wrapper around app.json. Lets EAS Build inject sensitive
// files (google-services.json, GoogleService-Info.plist) at build time via
// file-typed env vars without committing them to git.
//
// All other config still lives in app.json — this file only overrides the
// fields that need build-time substitution.

/* eslint-disable @typescript-eslint/no-require-imports */
module.exports = ({ config }) => {
  // process.env.GOOGLE_SERVICES_JSON is set by EAS to the absolute path of
  // the materialized secret file. Locally it's undefined and we fall back
  // to the path declared in app.json (./google-services.json).
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile;

  const googleServicesPlist =
    process.env.GOOGLE_SERVICES_INFO_PLIST ?? config.ios?.googleServicesFile;

  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile,
    },
    ios: {
      ...config.ios,
      ...(googleServicesPlist ? { googleServicesFile: googleServicesPlist } : {}),
    },
  };
};
