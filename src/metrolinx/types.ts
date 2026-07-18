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

// Fares — triple-nested category -> ticket -> fare rows (research handoff
// §2.8, cross-confirmed by a live capture, issue #3). Live-confirmed
// FareCategory.Type values include "Group Pass" alongside the four
// individual-rider types; it carries no per-rider concept and is filtered
// out during normalization (see normalize/fares.ts).
export interface RawFareEntry {
  Type: string;
  Amount: number;
  Category: string;
}

export interface RawFareTicket {
  Type: string;
  Fares: RawFareEntry[] | null;
}

export interface RawFareCategory {
  Type: string;
  Tickets: RawFareTicket[] | null;
}

export interface RawFaresResponse {
  Metadata: RawMetadata;
  AllFares?: { FareCategory?: RawFareCategory[] | null } | null;
}

// Fleet/Consist — physical train-consist makeup. Field list from the
// research handoff (§2.7, Help-page sourced); this session's
// METROLINX_API_KEY returned Metadata.ErrorCode "403" on both Consist
// endpoints (no live capture available — see test/fixtures/fleet-consist.json),
// so these shapes are hand-derived from documentation rather than confirmed
// against a real response. Revisit if a future capture run has Fleet access.
export interface RawConsistCar {
  Type: string;
  Order: number;
  Number: string;
}

export interface RawRemainingTrip {
  Number: string;
  Corridor: string;
  StartTime: string;
  EndTime: string;
  FirstStop: string;
  LastStop: string;
  InService: boolean;
}

export interface RawConsist {
  Number: string;
  CoachCount: number;
  EngineNumber: string;
  Lineup: RawConsistCar[] | null;
  RemainingTrip: RawRemainingTrip[] | null;
}

export interface RawFleetConsistResponse {
  Metadata: RawMetadata;
  AllConsists?: { Consists?: RawConsist[] | null } | null;
// ServiceUpdate/{ServiceAlert,InformationAlert,MarketingAlert}/All — the
// three feeds share this exact shape (confirmed live for ServiceAlert,
// issue #9; ticket 001 documents Information/Marketing as identical).
export interface RawAlertLine {
  Code: string;
}

export interface RawAlertStop {
  Name: string | null;
  Code: string;
}

export interface RawAlertTrip {
  TripNumber: string;
}

export interface RawAlertMessage {
  Code: string;
  ParentCode: string | null;
  Status: string;
  PostedDateTime: string;
  SubjectEnglish: string;
  SubjectFrench: string;
  BodyEnglish: string;
  BodyFrench: string;
  Category: string;
  SubCategory: string;
  Lines: RawAlertLine[] | null;
  Stops: RawAlertStop[] | null;
  Trips: RawAlertTrip[] | null;
}

export interface RawAlertsResponse {
  Metadata: RawMetadata;
  Messages?: { Message?: RawAlertMessage[] | null } | null;
}

// ServiceUpdate/UnionDepartures/All — the Union Station departure board.
// Confirmed live (issue #9): Stops[].Code is always null across every
// captured departure — only the short-form Name is populated.
export interface RawUnionStop {
  Name: string;
  Code: string | null;
}

export interface RawUnionTrip {
  Info: string;
  TripNumber: string;
  Platform: string;
  Service: string;
  ServiceType: string;
  Time: string;
  Stops: RawUnionStop[] | null;
}

export interface RawUnionDeparturesResponse {
  Metadata: RawMetadata;
  AllDepartures?: { Trip?: RawUnionTrip[] | null } | null;
}

// ServiceUpdate/Exceptions/{Train,Bus,All} — not part of issue #3's capture
// batch; shape sourced from the ticket 001 Help-page research, not yet
// empirically re-verified against a live capture.
// IsCancelled/IsOverride/IsStopping confirmed live (issue #9 follow-up) as
// JSON strings ("True"/"False"), not native booleans — the Help-page
// research this shape was originally sourced from didn't show this.
export interface RawExceptionStop {
  Order: number;
  ID: string;
  SchArrival: string | null;
  SchDeparture: string | null;
  Name: string;
  IsStopping: boolean | string;
  IsCancelled: boolean | string;
  IsOverride: boolean | string;
  Code: string;
  ActualTime: string | null;
  ServiceType: string;
}

export interface RawExceptionTrip {
  TripNumber: string;
  TripName: string;
  IsCancelled: boolean | string;
  IsOverride: boolean | string;
  Stop: RawExceptionStop[] | null;
}

export interface RawServiceExceptionsResponse {
  Metadata: RawMetadata;
  Trip?: RawExceptionTrip[] | null;
}

// ServiceUpdate/ServiceGuarantee/{TripNumber}/{OperationalDay} — not part of
// issue #3's capture batch; shape sourced from the ticket 001 Help-page
// research, not yet empirically re-verified against a live capture.
export interface RawGuaranteeStop {
  Code: string;
  Scope: string;
  ReasonEn: string;
  ReasonFr: string;
}

export interface RawServiceGuaranteeResponse {
  Metadata: RawMetadata;
  Stops?: { Stop?: RawGuaranteeStop[] | null } | null;
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
// Shape confirmed live (issue #8 follow-up), which corrected several
// assumptions from the documented Help-page field list (research handoff
// §2.4): `ArrivalTime`/`DepartureTime.Scheduled`/`Computed` are bare
// "HH:MM" with no date component (not a full naive datetime like
// Schedule/Line — see time.ts's combineDateAndHhmm); `Status` fields are
// single-letter codes from the same S/M vocabulary confirmed for
// Stop/NextService (tool-schemas spec §5); `Longitude`/`Latitude` are
// `0`/`0` when the trip isn't currently tracked (NextService's -1/-1
// placeholder doesn't apply here); `Destination` is a bare stop code, not
// a name; `Track.Actual` can be `null`.
export interface RawTripStatusTime {
  Scheduled: string;
  Computed: string;
  Status: string;
}

export interface RawTripStatusTrack {
  Scheduled: string | null;
  Actual: string | null;
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
