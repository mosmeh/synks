module.exports = {
    env: {
        browser: true,
        es2020: true,
    },
    extends: ['google', 'prettier'],
    parserOptions: {
        sourceType: 'module',
    },
    rules: {
        'require-jsdoc': 'off',
    },
};
