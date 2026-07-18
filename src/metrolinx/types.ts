// Raw Metrolinx response shapes, PascalCase exactly as delivered upstream.
// Confirmed against live captures by scripts/capture-fixtures.ts (issue #3) —
// see test/fixtures/ for the underlying samples.

export interface RawMetadata {
  TimeStamp: string;
  ErrorCode: string;
  ErrorMessage: string;
}

export interface RawFacility {
  Code: string;
  Description: string;
  DescriptionFr: string;
}

export interface RawParkingLot {
  Name: string;
  NameFr: string;
  ParkSpots: string | number;
  Type: string;
}

export interface RawStop {
  Code: string;
  StopName: string;
  StopNameFr: string;
  City: string;
  // Confirmed live: numeric strings, not numbers.
  Latitude: string;
  Longitude: string;
  IsBus: boolean;
  IsTrain: boolean;
  Facilities: RawFacility[] | null;
  Parkings: RawParkingLot[] | null;
  // No AccessibilityInfo field exists upstream — accessibility is signaled
  // via Facilities codes (WAT, UPWAT) instead; derived in normalize/.
  BoardingInfo: string;
  BoardingInfoFr: string;
  DrivingDirections: string;
  DrivingDirectionsFr: string;
}

export interface RawStopDetailsResponse {
  Metadata: RawMetadata;
  Stop?: RawStop | null;
}

// Stop/All — a distinct shape from Stop/Details; the same physical stop's
// code is spelled `LocationCode` here vs `Code` on Stop/Details.
export interface RawStopListEntry {
  LocationCode: string;
  PublicStopId: string;
  LocationName: string;
  LocationType: string;
}

export interface RawStopAllResponse {
  Metadata: RawMetadata;
  Stations?: { Station?: RawStopListEntry[] | null } | null;
}

// Stop/NextService — live departures for one stop.
export interface RawNextServiceLine {
  StopCode: string;
  LineCode: string;
  LineName: string;
  ServiceType: string;
  DirectionCode: string;
  DirectionName: string;
  ScheduledDepartureTime: string;
  ComputedDepartureTime: string;
  DepartureStatus: string;
  ScheduledPlatform: string;
  ActualPlatform: string;
  TripOrder: number;
  TripNumber: string;
  UpdateTime: string;
  Status: string;
  Latitude: number;
  Longitude: number;
}

export interface RawNextServiceResponse {
  Metadata: RawMetadata;
  NextService?: { Lines?: RawNextServiceLine[] | null } | null;
}

// Stop/Destinations — where a stop's services go within a time window.
// Confirmed live (issue #7): no line-name field, and entries repeat once
// per departure in the window rather than once per distinct destination.
export interface RawDestinationLine {
  Code: string;
  Display: string;
  Direction: string;
  DestinationStop: string;
}

export interface RawStopDestinationsResponse {
  Metadata: RawMetadata;
  Stop?: {
    Code: string;
    Name: string;
    Line?: RawDestinationLine[] | null;
  } | null;
}

// Schedule/Line/All/{Date} — the full line/variant roster for a service day.
export interface RawLineVariant {
  Code: string;
  Display: string;
  Direction: string;
}

export interface RawLineAllEntry {
  Name: string;
  Code: string;
  IsBus: boolean;
  IsTrain: boolean;
  Variant: RawLineVariant[] | null;
}

export interface RawLineAllResponse {
  Metadata: RawMetadata;
  AllLines?: { Line?: RawLineAllEntry[] | null } | null;
}

// Schedule/Line/{Date}/{LineCode}/{LineDirection} — one line/direction's full
// service day, every trip x every stop (tool-schemas spec §2.11: never
// returned as-is, get_line_schedule is anti-dump by design).
export interface RawLineScheduleStop {
  Code: string;
  Order: number;
  Time: string;
  sortingTime: string | null;
  IsMajor: boolean;
}

export interface RawLineScheduleTrip {
  Number: string;
  Display: string;
  Stops: RawLineScheduleStop[] | null;
}

export interface RawLineScheduleEntry {
  Code: string;
  Direction: string;
  Type: string;
  Trip: RawLineScheduleTrip[] | null;
}

export interface RawLineScheduleResponse {
  Metadata: RawMetadata;
  Lines?: { Line?: RawLineScheduleEntry[] | null } | null;
}

// Schedule/Trip/{Date}/{TripNumber} — one trip's live stop-by-stop status.
// Shape per the documented Help-page field list (research handoff §2.4):
// `Trips[]{Number, Destination, Longitude, Latitude, Status, TimeStamp,
// Stops[]{ArrivalTime{Scheduled,Computed,Status}, DepartureTime{Scheduled,
// Computed,Status}, Track{Scheduled,Actual}, Code, Status, Remark}}`. Not yet
// captured live — issue #3's capture script doesn't cover this endpoint and
// no key/network was available to add it here; revisit against a real
// capture (e.g. the weekly smoke run) if fields disagree.
export interface RawTripStatusTime {
  Scheduled: string;
  Computed: string;
  Status: string;
}

export interface RawTripStatusTrack {
  Scheduled: string;
  Actual: string;
}

export interface RawTripStatusStop {
  Code: string;
  ArrivalTime?: RawTripStatusTime | null;
  DepartureTime?: RawTripStatusTime | null;
  Track?: RawTripStatusTrack | null;
  Status: string;
  Remark?: string | null;
}

export interface RawTripStatusEntry {
  Number: string;
  Destination: string;
  Longitude: number | string;
  Latitude: number | string;
  Status: string;
  TimeStamp: string;
  Stops?: RawTripStatusStop[] | null;
}

export interface RawTripStatusResponse {
  Metadata: RawMetadata;
  Trips?: RawTripStatusEntry[] | null;
}
