sap.ui.define(
  [
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/resource/ResourceModel",
    "tracker/model/store",
  ],
  function (UIComponent, JSONModel, ResourceModel, Store) {
    "use strict";
    return UIComponent.extend("tracker.Component", {
      metadata: { manifest: "json" },
      init() {
        UIComponent.prototype.init.apply(this, arguments);
        this.setModel(
          new ResourceModel({
            bundleName: "tracker.i18n.i18n",
            supportedLocales: [""],
            fallbackLocale: "",
          }),
          "i18n",
        );
        let d;
        try {
          d = Store.load();
        } catch (e) {
          d = Store.seed();
          d.loadError = true;
        }
        this.setModel(new JSONModel(d));
        this.getRouter().initialize();
      },
    });
  },
);
