/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["**/test/**/*.test.ts"],
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/test/mocks/obsidian.ts",
	},
};
