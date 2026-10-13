require('dotenv').config();

const inlineEnvPlugin = ({ types: t }) => ({
  visitor: {
    MemberExpression(path) {
      if (path.get('object').matchesPattern('process.env')) {
        const key = path.toComputedKey();
        if (t.isStringLiteral(key) && process.env[key.value] !== undefined) {
          path.replaceWith(t.valueToNode(process.env[key.value]));
        }
      }
    },
  },
});

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [inlineEnvPlugin],
};
