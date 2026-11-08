const { spawnSync } = require("node:child_process");
const path = require("node:path");
const result = spawnSync(
  process.execPath,
  [require.resolve("@ui5/cli/bin/ui5.cjs"), ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      UI5_DATA_DIR: process.env.UI5_DATA_DIR || path.resolve(".ui5"),
    },
  },
);
process.exit(result.status ?? 1);
