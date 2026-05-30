import { lazy, Suspense } from "react";

const AdminCoursesManager = lazy(() => import("@/components/dashboard/AdminCoursesManager"));

const AdminCoursesPage = () => (
  <Suspense fallback={<div className="p-8">Loading course manager...</div>}>
    <AdminCoursesManager />
  </Suspense>
);

export default AdminCoursesPage;
