/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const renames = [
      ["areas", "regula_areas"],
      ["programs", "regula_programs"],
      ["resources", "regula_resources"],
      ["study_items", "regula_study_items"],
      ["study_sessions", "regula_study_sessions"],
      ["item_events", "regula_item_events"],
      ["user_settings", "regula_user_settings"],
    ];

    for (const [oldName, newName] of renames) {
      const collection = app.findCollectionByNameOrId(oldName);
      collection.name = newName;
      app.save(collection);
    }
  },
  (app) => {
    const renames = [
      ["regula_areas", "areas"],
      ["regula_programs", "programs"],
      ["regula_resources", "resources"],
      ["regula_study_items", "study_items"],
      ["regula_study_sessions", "study_sessions"],
      ["regula_item_events", "item_events"],
      ["regula_user_settings", "user_settings"],
    ];

    for (const [oldName, newName] of renames) {
      const collection = app.findCollectionByNameOrId(oldName);
      collection.name = newName;
      app.save(collection);
    }
  },
);
