module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    // react-native-worklets/plugin goes here once Reanimated animations are added (Phase 2+).
    // Keeping it out now: no worklet code exists yet and it breaks Expo Go on new arch.
  };
};
