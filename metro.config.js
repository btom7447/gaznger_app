const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// sonner-native v0.23.x ships a broken package.json that points `main` and
// `exports` to `lib/module/index.js`, which doesn't exist in the published
// package. Redirect to the commonjs build that does exist.
// We use path.resolve instead of require.resolve to bypass exports validation.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "sonner-native") {
    return {
      filePath: path.resolve(
        __dirname,
        "node_modules/sonner-native/lib/commonjs/index.js"
      ),
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
