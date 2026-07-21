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
}

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
// IsCancelled/IsOverride/IsStopping confirmed live 2026-07-21 (issue #27) as
// the numeric-string wire values "0"/"1", not native booleans — and not
// "True"/"False" either, despite this comment previously claiming that was
// already confirmed (it wasn't; see src/normalize/service-exceptions.ts).
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

// ServiceataGlance/{Trains,Buses,UPX}/All — live positions for one mode.
// Confirmed live against all three (issue #45): Trains carry Cars, Buses
// carry BusType instead — the two fields are mutually exclusive, never both
// present on the same trip. UPX returned Metadata.ErrorCode "204" (no UPX
// service running at capture time) so its shape is unconfirmed but presumed
// to match Trains/Buses (documented as the same endpoint family).
export interface RawServiceGlanceTrip {
  Cars?: string;
  BusType?: string;
  TripNumber: string;
  StartTime: string;
  EndTime: string;
  LineCode: string;
  RouteNumber: string;
  VariantDir: string;
  Display: string;
  Latitude: number;
  Longitude: number;
  IsInMotion: boolean;
  DelaySeconds: number;
  Course: number;
  FirstStopCode: string;
  LastStopCode: string;
  PrevStopCode: string;
  NextStopCode: string | null;
  AtStationCode: string | null;
  ModifiedDate: string;
}

export interface RawServiceGlanceResponse {
  Metadata: RawMetadata;
  Trips?: { Trip?: RawServiceGlanceTrip[] | null } | null;
}

// GTFS-RT feeds (Gtfs/Feed/*) — consumed as JSON via the Accept header, no
// protobuf dependency (project-architecture spec §4). No Metadata envelope;
// these are raw gtfs-realtime.proto FeedMessages, snake_case as delivered.
export interface RawGtfsTrip {
  trip_id: string;
  route_id: string;
  direction_id: number;
  start_time: string;
  start_date: string;
  schedule_relationship: string;
}

export interface RawGtfsVehicleDescriptor {
  id?: string | null;
  label?: string | null;
  license_plate?: string | null;
}

export interface RawGtfsStopTimeEvent {
  delay?: number | null;
  time?: number | null;
  uncertainty?: number | null;
}

// TripUpdates — confirmed live (issue #3): `arrival` is always null,
// `departure` always populated for GO rail trip updates.
export interface RawGtfsStopTimeUpdate {
  stop_id: string;
  arrival?: RawGtfsStopTimeEvent | null;
  departure?: RawGtfsStopTimeEvent | null;
  schedule_relationship: string;
}

export interface RawGtfsTripUpdate {
  trip: RawGtfsTrip;
  vehicle?: RawGtfsVehicleDescriptor | null;
  stop_time_update: RawGtfsStopTimeUpdate[];
  timestamp: number;
  delay?: number | null;
}

export interface RawGtfsTripUpdateEntity {
  id: string;
  is_deleted: boolean;
  trip_update?: RawGtfsTripUpdate | null;
}

export interface RawGtfsTripUpdatesResponse {
  // No Metadata envelope on GTFS-RT feeds — declared (never populated) so
  // this type structurally satisfies MetrolinxHttpClient's shared
  // RawEnvelope constraint; the tunneled-error check is a no-op here.
  Metadata?: RawMetadata | null;
  header: {
    gtfs_realtime_version: string;
    incrementality: string;
    timestamp: number;
  };
  entity: RawGtfsTripUpdateEntity[];
}

// Gtfs/Feed/VehiclePosition — the plain feed, same section as TripUpdates
// above. NOT Fleet/Occupancy/GtfsRT/Feed/VehiclePosition: that Fleet-branded
// twin is where occupancy_status/occupancy_percentage is documented as
// populated (handoff-001, §2.7), but it empirically returns a genuine HTTP
// 401 for a standard registered key (confirmed live against issue #11/PR
// #26, 2026-07-18) — contradicting how this API signals auth failures
// everywhere else (body-tunneled Metadata.ErrorCode over HTTP 200, per
// handoff-001 §4), meaning it needs elevated access this project's key
// doesn't have. Recorded in docs/spec/tool-schemas.md §5. The plain feed
// works with a standard key (same as TripUpdates) but its occupancy fields
// are consequently expected to be absent in practice; kept as optional
// fields so occupancy_percent still populates automatically if Metrolinx
// ever starts filling them in here too. NOT live-captured (no
// METROLINX_API_KEY/network available in the session that authored this
// file), per the test-architecture spec's carve-out for shapes live capture
// can't produce on demand. `occupancy_percentage` is the standard
// gtfs-realtime.proto field name (uint32, 0-100); its exact casing on this
// endpoint is unconfirmed against a real response — revisit once a real
// capture is available.
export interface RawGtfsVehiclePosition {
  trip: RawGtfsTrip;
  vehicle?: RawGtfsVehicleDescriptor | null;
  position: {
    latitude: number;
    longitude: number;
    bearing?: number | null;
    odometer?: number | null;
    speed?: number | null;
  };
  stop_id?: string | null;
  current_status?: string | null;
  congestion_level?: string | null;
  timestamp: number;
  occupancy_status?: string | null;
  occupancy_percentage?: number | null;
}

export interface RawGtfsVehiclePositionEntity {
  id: string;
  is_deleted: boolean;
  vehicle?: RawGtfsVehiclePosition | null;
}

export interface RawGtfsVehiclePositionsResponse {
  // No Metadata envelope on GTFS-RT feeds — see RawGtfsTripUpdatesResponse.
  Metadata?: RawMetadata | null;
  header: {
    gtfs_realtime_version: string;
    incrementality: string;
    timestamp: number;
  };
  entity: RawGtfsVehiclePositionEntity[];
}

// Schedule/Journey/{Date}/{FromStopCode}/{ToStopCode}/{StartTime}/{MaxJourney}
// — the trip planner. Shape confirmed live (issue #3 fixture capture,
// test/fixtures/schedule-journey.json): a Trip's Stops carry the same
// Code/Order/Time/sortingTime/IsMajor shape as Schedule/Line (bare "HH:MM",
// no date — combine with the journey entry's own Date field). Stops carry
// no stop name of their own, same gap as Schedule/Trip — resolved via the
// cached Stop/All dataset (same pattern as get_trip_status).
export interface RawJourneyStop {
  Code: string;
  Order: number;
  Time: string;
  sortingTime: string | null;
  IsMajor: boolean;
}

export interface RawJourneyTrip {
  Number: string;
  Display: string;
  Line: string;
  Direction: string;
  LineVariant: string;
  Type: string;
  Stops?: { Stop?: RawJourneyStop[] | null } | null;
  destinationStopCode: string;
  departFromCode: string;
  departFromAlternativeCode: string | null;
  departFromTimingPoint: string;
  tripPatternId: number;
}

export interface RawJourneyTransfer {
  Code: string;
  Order: number;
  Time: string;
}

export interface RawJourneyTransferLink {
  FromTrip: string;
  FromStopCode: string;
  ToTrip: string;
  ToStopCode: string;
  TransferDuration: string;
}

export interface RawJourneyService {
  Colour: string;
  Type: string;
  Direction: string;
  Code: string;
  StartTime: string;
  EndTime: string;
  Duration: string;
  // "" / "R" / "B" / "RB" per the research handoff; every live-captured
  // sample so far is "" (no accessible service on that journey) — the
  // R/B/RB-present case is unconfirmed (tool-schemas spec §5 pattern).
  Accessible: string;
  Trips?: { Trip?: RawJourneyTrip[] | null } | null;
  Transfers?: { Transfer?: RawJourneyTransfer[] | null } | null;
  TransferLinks?: { Link?: RawJourneyTransferLink[] | null } | null;
}

export interface RawJourneyEntry {
  Date: string;
  Time: string;
  To: string;
  From: string;
  Services?: RawJourneyService[] | null;
}

export interface RawJourneyResponse {
  Metadata: RawMetadata;
  SchJourneys?: RawJourneyEntry[] | null;
}
