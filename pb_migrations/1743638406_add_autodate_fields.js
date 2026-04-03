/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const collectionNames = [
      "areas",
      "programs",
      "resources",
      "study_items",
      "study_sessions",
      "item_events",
    ];

    for (const name of collectionNames) {
      const collection = app.findCollectionByNameOrId(name);

      collection.fields.add(
        new AutodateField({
          name: "created",
          onCreate: true,
          onUpdate: false,
          system: true,
        }),
      );

      collection.fields.add(
        new AutodateField({
          name: "updated",
          onCreate: true,
          onUpdate: true,
          system: true,
        }),
      );

      app.save(collection);
    }
  },
  (app) => {
    const collectionNames = [
      "areas",
      "programs",
      "resources",
      "study_items",
      "study_sessions",
      "item_events",
    ];

    for (const name of collectionNames) {
      const collection = app.findCollectionByNameOrId(name);

      const createdField = collection.fields.getByName("created");
      if (createdField) collection.fields.remove(createdField);

      const updatedField = collection.fields.getByName("updated");
      if (updatedField) collection.fields.remove(updatedField);

      app.save(collection);
    }
  },
);
