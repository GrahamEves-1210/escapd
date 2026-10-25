// Chains Reanimated's Jest resolver (web implementations of worklet-only
// modules) in front of React Native's, which jest-expo uses by default.
const reactNativeResolver = require("@react-native/jest-preset/jest/resolver");
const reanimatedResolver = require("react-native-reanimated/jest/resolver");

module.exports = (request, options) =>
  reanimatedResolver(request, {
    ...options,
    defaultResolver: (req, opts) => reactNativeResolver(req, { ...opts, defaultResolver: options.defaultResolver }),
  });
