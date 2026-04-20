import type { QueryClient } from "@tanstack/react-query";

/**
 * Invalidates all dashboard-related caches.
 * Call this whenever actions that affect the dashboard occur (lesson status changes,
 * assessment completion, review changes, vacations changes, etc.)
 */
export function invalidateDashboardCaches(qc: QueryClient): void {
  // Invalidate all dashboard queries
  void qc.invalidateQueries({ queryKey: ["dashboard"] });
}

/**
 * Invalidates all lesson-related caches.
 * Call this whenever lessons are created, updated, or deleted.
 */
export function invalidateLessonCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["lessons"] });
  void qc.invalidateQueries({ queryKey: ["dashboard"] });
  void qc.invalidateQueries({ queryKey: ["item_events"] });
}

/**
 * Invalidates all assessment-related caches.
 * Call this whenever assessments are created, updated, or deleted.
 */
export function invalidateAssessmentCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["assessments"] });
  void qc.invalidateQueries({ queryKey: ["dashboard"] });
}

/**
 * Invalidates all review-related caches.
 * Call this whenever reviews are created, updated, deleted, or completed.
 */
export function invalidateReviewCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["reviews"] });
  void qc.invalidateQueries({ queryKey: ["dashboard"] });
}

/**
 * Invalidates all vacation-related caches.
 * Call this whenever vacations are created, updated, or deleted.
 */
export function invalidateVacationCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["vacations"] });
  void qc.invalidateQueries({ queryKey: ["lessons"] });
  void qc.invalidateQueries({ queryKey: ["dashboard"] });
}

/**
 * Invalidates all module-related caches.
 * Call this whenever modules are created, updated, or deleted.
 */
export function invalidateModuleCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["modules"] });
  void qc.invalidateQueries({ queryKey: ["lessons"] });
}

/**
 * Invalidates all program-related caches.
 * Call this whenever programs are created, updated, or deleted.
 */
export function invalidateProgramCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["programs"] });
  void qc.invalidateQueries({ queryKey: ["user_settings"] });
}

/**
 * Invalidates all area-related caches.
 * Call this whenever areas are created, updated, or deleted.
 */
export function invalidateAreaCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["areas"] });
  void qc.invalidateQueries({ queryKey: ["programs"] });
}

/**
 * Invalidates all user settings caches.
 * Call this whenever user settings are updated.
 */
export function invalidateSettingsCaches(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: ["user_settings"] });
  void qc.invalidateQueries({ queryKey: ["dashboard"] });
}
