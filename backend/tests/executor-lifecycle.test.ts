import { expect, test } from "bun:test";
import { configureExecutor, injectTaskService, startExecutor, stopExecutor, registerTaskHandler, notifyTaskCreated, getExecutorStatus } from "../src/core/tasks/executor.ts";
import { TaskTypes, type TaskRecord } from "../src/core/tasks/types.ts";

test("executor stop drains active work, prevents queued admission and supports restart", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const tasks: TaskRecord[] = [{
    id: 1, parent_task_id: null, type: TaskTypes.FILE_INDEX_LIBRARY,
    payload: { libraryId: 1 }, status: "PENDING", priority: 0, progress: 0,
    detail_progress: null, error_message: null, retry_count: 0, max_retries: 0,
    created_by_user_id: null, started_at: null, finished_at: null,
    created_at: "", updated_at: "",
  }];
  let runs = 0;
  let resets = 0;
  injectTaskService({
    listPendingTasks: () => tasks.filter(task => task.status === "PENDING"),
    getTaskById: id => tasks.find(task => task.id === id) ?? null,
    updateTaskStatus: ({ id, status }) => {
      const task = tasks.find(task => task.id === id)!;
      task.status = status as TaskRecord["status"];
      return task;
    },
    resetRunningTasks: () => { resets++; return 0; },
    incrementRetryCount: () => {},
    createTask: () => { throw new Error("unused"); },
  });
  registerTaskHandler(TaskTypes.FILE_INDEX_LIBRARY, async () => { runs++; await gate; });
  configureExecutor({ pollIntervalMs: 2 });
  startExecutor();
  startExecutor();
  expect(runs).toBe(1);
  expect(resets).toBe(1);
  let drained = false;
  const stopping = stopExecutor().then(() => { drained = true; });
  tasks.push({ ...tasks[0]!, id: 2, status: "PENDING" });
  notifyTaskCreated();
  await Bun.sleep(10);
  expect(drained).toBe(false);
  expect(runs).toBe(1);
  expect(() => startExecutor()).toThrow("draining");
  release();
  await stopping;
  await Bun.sleep(10);
  expect(tasks[0]!.status).toBe("SUCCESS");
  expect(tasks[1]!.status).toBe("PENDING");
  expect(getExecutorStatus().isStarted).toBe(false);
  startExecutor();
  await stopExecutor();
  expect(runs).toBe(2);
  expect(tasks[1]!.status).toBe("SUCCESS");
  expect(resets).toBe(2);
});
