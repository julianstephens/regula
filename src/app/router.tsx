import pb from "@/lib/pocketbase";
import Login from "@/routes/login";
import Root from "@/routes/root";
import { createBrowserRouter, redirect } from "react-router";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
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
        path: "areas",
        lazy: () =>
          import("@/routes/areas").then((m) => ({ Component: m.default })),
      },
      {
        path: "resources",
        lazy: () =>
          import("@/routes/resources").then((m) => ({ Component: m.default })),
      },
      {
        path: "study-items",
        lazy: () =>
          import("@/routes/study-items").then((m) => ({
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
        path: "sessions",
        lazy: () =>
          import("@/routes/sessions").then((m) => ({ Component: m.default })),
      },
      {
        path: "timeline",
        lazy: () =>
          import("@/routes/timeline").then((m) => ({ Component: m.default })),
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
