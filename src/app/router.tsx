import ErrorBoundary from "@/components/feedback/ErrorBoundary";
import pb from "@/lib/pocketbase";
import Login from "@/routes/login";
import Root from "@/routes/root";
import { createBrowserRouter, redirect } from "react-router";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    errorElement: <ErrorBoundary />,
    HydrateFallback: () => null,
    loader: async () => {
      if (!pb.authStore.isValid) {
        return redirect("/login");
      }
      return null;
    },
    children: [
      {
        index: true,
        lazy: () =>
          import("@/routes/dashboard").then((m) => ({ Component: m.default })),
      },
      {
        path: "programs",
        lazy: () =>
          import("@/routes/program-dashboard").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "programs/import",
        lazy: () =>
          import("@/routes/program-import").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "programs/:id",
        loader: ({ params }) => redirect(`/programs?program=${params.id}`),
      },
      {
        path: "modules/:id",
        loader: ({ params }) => redirect(`/programs?module=${params.id}`),
      },
      {
        path: "lessons/:id",
        lazy: () =>
          import("@/routes/lesson-detail").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "assessments",
        lazy: () =>
          import("@/routes/assessments").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "assessments/:id",
        lazy: () =>
          import("@/routes/assessment-detail").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "reviews",
        lazy: () =>
          import("@/routes/reviews").then((m) => ({ Component: m.default })),
      },

      {
        path: "calendar",
        lazy: () =>
          import("@/routes/calendar").then((m) => ({ Component: m.default })),
      },
      {
        path: "reports",
        lazy: () =>
          import("@/routes/reports").then((m) => ({ Component: m.default })),
      },
      {
        path: "settings",
        lazy: () =>
          import("@/routes/settings").then((m) => ({ Component: m.default })),
      },
      {
        path: "docs",
        lazy: () =>
          import("@/routes/docs").then((m) => ({ Component: m.default })),
      },
    ],
  },
  {
    path: "/login",
    loader: () => {
      if (pb.authStore.isValid) {
        return redirect("/");
      }
      return null;
    },
    element: <Login />,
  },
]);

export default router;
