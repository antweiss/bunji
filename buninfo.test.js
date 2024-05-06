import { expect, test } from "bun:test";
import { getMem, getCPU } from "./info.js";

test("checkCPU", async () => {
  const data = await getCPU();
  expect(data.cores).toBeGreaterThan(0);
}, 50);

test("checkMem", async () => {
  const data = await getMem();
  expect(data.total).toBeGreaterThan(0);
}, 50);

test("checkFreeMem", async () => {
  const data = await getMem();
  //replace this with expect(data.total).toBeGreaterThan(data.free);
  //for the test to succeed
  expect(data.total).toBeGreaterThan(data.free);
}, 50);
