/** Public file reads, security checks and task identifiers for other modules.
 * Never re-export task handlers: media depends on these reads, while file tasks
 * depend on media maintenance. Keeping handlers out prevents an import cycle.
 */
export { checkEntryPasswordIfProtected, assertLibraryRootOwnership } from "./security.ts";
export { getEntryById, listEntriesByParent, resolveRealPathForEntry } from "./service.ts";
export { searchByFts } from "./ftsService.ts";
export {
  TASK_TYPE_FILE_DELETE_ENTRY,
  TASK_TYPE_FILE_RESTORE_ENTRY,
  TASK_TYPE_FILE_DESTROY_ENTRY,
  TASK_TYPE_FILE_RENAME_ENTRY,
  TASK_TYPE_FILE_MOVE_ENTRY,
  TASK_TYPE_FILE_COPY_ENTRY,
  TASK_TYPE_FILE_INDEX_LIBRARY,
  TASK_TYPE_FILE_INDEX_SINGLE,
} from "./taskTypes.ts";
