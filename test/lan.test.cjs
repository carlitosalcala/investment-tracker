const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

test("Add six stocks works on HTTP LAN origins without randomUUID and skips duplicates", () => {
  const context = vm.createContext({
    module: { exports: {} },
    crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
  });
  vm.runInContext(
    fs.readFileSync(require.resolve("../webapp/model/finance.js"), "utf8"),
    context,
  );
  const F = context.module.exports;
  const ids = new Set(Array.from({ length: 100 }, () => F.newId()));
  assert.equal(ids.size, 100);
  for (const id of ids)
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

  let controller;
  const messages = [];
  const storeContext = vm.createContext({
    sap: {
      ui: {
        define: (_, factory) => {
          storeContext.store = factory(F);
        },
      },
    },
  });
  vm.runInContext(
    fs.readFileSync(require.resolve("../webapp/model/store.js"), "utf8"),
    storeContext,
  );
  const data = storeContext.store.seed();
  const controllerContext = vm.createContext({
    sap: {
      ui: {
        define: (dependencies, factory) => {
          factory(
            ...dependencies.map((name) => {
              if (name === "sap/ui/core/mvc/Controller")
                return {
                  extend: (_, methods) => {
                    controller = methods;
                  },
                };
              if (name === "sap/m/MessageBox")
                return { information: (message) => messages.push(message) };
              if (name === "tracker/model/finance") return F;
              return {};
            }),
          );
        },
      },
    },
  });
  vm.runInContext(
    fs.readFileSync(
      require.resolve("../webapp/controller/Main.controller.js"),
      "utf8",
    ),
    controllerContext,
  );
  let saves = 0;
  const instance = {
    data: () => data,
    save: () => {
      saves++;
    },
    t: () => "Added {0}",
  };
  controller.onAddStocks.call(instance);
  assert.equal(data.assets.length, 10);
  assert.equal(data.assets.filter((a) => a.type === "Stock").length, 6);
  F.restore(JSON.stringify(data));
  controller.onAddStocks.call(instance);
  assert.equal(data.assets.length, 10);
  assert.equal(saves, 1);
  assert.deepEqual(messages, ["Added 6", "Added 0"]);
});
