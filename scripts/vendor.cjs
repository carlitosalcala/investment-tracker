const fs = require("node:fs");
fs.mkdirSync("webapp/vendor", { recursive: true });
for (const name of ["chart.umd.js", "chart.umd.js.map"])
  fs.copyFileSync(
    "node_modules/chart.js/dist/" + name,
    "webapp/vendor/" + name,
  );
