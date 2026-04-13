/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const studySessionsCol = app.findCollectionByNameOrId(
      "regula_study_sessions",
    );
    const lessonsCol = app.findCollectionByNameOrId("regula_lessons");

    // Remove the old study_items multi-relation field
    studySessionsCol.fields.removeByName("study_items");

    // Add the new lessons multi-relation field pointing to regula_lessons
    studySessionsCol.fields.add(
      new RelationField({
        name: "lessons",
        required: false,
        collectionId: lessonsCol.id,
        cascadeDelete: false,
        maxSelect: null,
      }),
    );

    return app.save(studySessionsCol);
  },
  (app) => {
    const studySessionsCol = app.findCollectionByNameOrId(
      "regula_study_sessions",
    );
    const studyItemsCol = app.findCollectionByNameOrId("regula_study_items");

    studySessionsCol.fields.removeByName("lessons");

    studySessionsCol.fields.add(
      new RelationField({
        name: "study_items",
        required: false,
        collectionId: studyItemsCol.id,
        cascadeDelete: false,
        maxSelect: null,
      }),
    );

    return app.save(studySessionsCol);
  },
);
