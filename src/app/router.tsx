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
          import("@/routes/programs").then((m) => ({ Component: m.default })),
      },
      {
        path: "programs/:id",
        lazy: () =>
          import("@/routes/program-detail").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "programs/:id/import",
        lazy: () =>
          import("@/routes/import").then((m) => ({ Component: m.default })),
      },
      {
        path: "courses",
        lazy: () =>
          import("@/routes/areas").then((m) => ({ Component: m.default })),
      },
      {
        path: "resources",
        lazy: () =>
          import("@/routes/resources").then((m) => ({ Component: m.default })),
      },
      {
        path: "homework",
        lazy: () =>
          import("@/routes/homework").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "study-items/:id",
        lazy: () =>
          import("@/routes/study-item-detail").then((m) => ({
            Component: m.default,
          })),
      },
      {
        path: "calendar",
        lazy: () =>
          import("@/routes/calendar").then((m) => ({ Component: m.default })),
      },
      {
        path: "syllabus",
        lazy: () =>
          import("@/routes/syllabus").then((m) => ({ Component: m.default })),
      },
      {
        path: "settings",
        lazy: () =>
          import("@/routes/settings").then((m) => ({ Component: m.default })),
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
