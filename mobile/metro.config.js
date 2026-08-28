const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable experimental package exports that load ESM builds incompatible with Hermes
config.resolver.unstable_enablePackageExports = false;

// Force CJS resolution order so packages resolve to CommonJS builds
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
