const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// @react-native/virtualized-lists@0.87.x deep-imports this module, but
// react-native's package.json "exports" doesn't list it, so Metro warns on
// every bundle. Resolve it directly to the file to silence the warning.
// Remove once react-native exposes the subpath or stops deep-importing it.
const RN_FEATURE_FLAGS = 'react-native/src/private/featureflags/ReactNativeFeatureFlags';
const rnFeatureFlagsPath = path.join(
  path.dirname(require.resolve('react-native/package.json')),
  'src/private/featureflags/ReactNativeFeatureFlags.js',
);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === RN_FEATURE_FLAGS) {
        return { type: 'sourceFile', filePath: rnFeatureFlagsPath };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
