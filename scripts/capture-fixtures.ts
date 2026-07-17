#!/usr/bin/env tsx
// Manual, real-key script: captures one representative live response per
// upstream endpoint family into test/fixtures/. Re-run and diff to detect
// upstream drift (test-architecture spec §1). The first run also doubles as
// the empirical verification pass for enum meanings and timestamp formats
// (tool-schemas spec §5) — read the printed summary at the end.
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI/api/V1";
const FIXTURES_DIR = fileURLToPath(
  new URL("../test/fixtures/", import.meta.url),
);

function loadEnvKey(): string {
  if (process.env.METROLINX_API_KEY) return process.env.METROLINX_API_KEY;
  try {
    // Minimal .env parser — no dotenv dependency for a one-off script.
    const raw = readFileSync(
      fileURLToPath(new URL("../.env", import.meta.url)),
      "utf8",
    );
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key === "METROLINX_API_KEY" && value) return value;
    }
  } catch {
    // fall through to error below
  }
  throw new Error("METROLINX_API_KEY not set (checked env and .env)");
}

const API_KEY = loadEnvKey();

async function fetchJson<T>(path: string): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("key", API_KEY);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${String(response.status)} for ${path}`);
  }
  return (await response.json()) as T;
}

async function save(name: string, data: unknown): Promise<void> {
  const path = `${FIXTURES_DIR}${name}.json`;
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`saved ${name}.json`);
}

function todayYyyymmdd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${String(y)}${m}${d}`;
}

function hhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
}

interface StopAllResponse {
  Stations?: { Station?: { LocationCode: string; LocationName: string }[] };
}
interface LineAllResponse {
  AllLines?: {
    Line?: {
      Code: string;
      Name: string;
      Variant?: { Code: string; Direction: string }[];
    }[];
  };
}
interface NextServiceResponse {
  NextService?: {
    Lines?: {
      DepartureStatus?: string;
      Status?: string;
      ScheduledDepartureTime?: string;
      ComputedDepartureTime?: string;
    }[];
  };
}

async function main(): Promise<void> {
  await mkdir(FIXTURES_DIR, { recursive: true });
  const date = todayYyyymmdd();

  const stopAll = await fetchJson<StopAllResponse>("/Stop/All");
  await save("stop-all", stopAll);

  const oakville = stopAll.Stations?.Station?.find((s) =>
    s.LocationName.toLowerCase().includes("oakville"),
  );
  if (!oakville)
    throw new Error(
      "Could not find Oakville in Stop/All — pick another destination stop code manually",
    );
  console.log(`Oakville stop code: ${oakville.LocationCode}`);

  const stopDetails = await fetchJson("/Stop/Details/UN");
  await save("stop-details", stopDetails);

  const nextService = await fetchJson<NextServiceResponse>(
    "/Stop/NextService/UN",
  );
  await save("stop-next-service", nextService);

  const lineAll = await fetchJson<LineAllResponse>(
    `/Schedule/Line/All/${date}`,
  );
  await save("schedule-line-all", lineAll);

  const lw = lineAll.AllLines?.Line?.find((l) => l.Code === "LW");
  const direction = lw?.Variant?.[0]?.Direction;
  if (lw && direction) {
    const lineSchedule = await fetchJson(
      `/Schedule/Line/${date}/LW/${direction}`,
    );
    await save("schedule-line", lineSchedule);
  } else {
    console.warn(
      "LW line/direction not found today — skipped schedule-line.json",
    );
  }

  const journey = await fetchJson(
    `/Schedule/Journey/${date}/UN/${oakville.LocationCode}/0900/3`,
  );
  await save("schedule-journey", journey);

  await save(
    "service-alerts",
    await fetchJson("/ServiceUpdate/ServiceAlert/All"),
  );
  await save(
    "union-departures",
    await fetchJson("/ServiceUpdate/UnionDepartures/All"),
  );
  await save(
    "service-glance-trains",
    await fetchJson("/ServiceataGlance/Trains/All"),
  );
  await save("gtfs-trip-updates", await fetchJson("/Gtfs/Feed/TripUpdates"));
  await save("fares", await fetchJson(`/Fares/UN/${oakville.LocationCode}`));
  await save("fleet-consist", await fetchJson("/Fleet/Consist/All"));

  const now = new Date();
  const fromTime = hhmm(now);
  const toTime = hhmm(new Date(now.getTime() + 4 * 60 * 60 * 1000));
  await save(
    "stop-destinations",
    await fetchJson(`/Stop/Destinations/UN/${fromTime}/${toTime}`),
  );

  // Empirical verification summary — read this to confirm enum meanings and
  // timestamp formats for docs/spec/tool-schemas.md §5.
  const statuses = new Set<string>();
  const departureStatuses = new Set<string>();
  const timestamps = new Set<string>();
  for (const line of nextService.NextService?.Lines ?? []) {
    if (line.Status) statuses.add(line.Status);
    if (line.DepartureStatus) departureStatuses.add(line.DepartureStatus);
    if (line.ScheduledDepartureTime)
      timestamps.add(line.ScheduledDepartureTime);
    if (line.ComputedDepartureTime) timestamps.add(line.ComputedDepartureTime);
  }
  console.log("\n--- Empirical verification summary ---");
  console.log("DepartureStatus values seen:", [...departureStatuses]);
  console.log("Status values seen:", [...statuses]);
  console.log("Sample timestamp strings:", [...timestamps].slice(0, 5));
}

await main();
