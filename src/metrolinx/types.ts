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
export interface RawExceptionStop {
  Order: number;
  ID: string;
  SchArrival: string | null;
  SchDeparture: string | null;
  Name: string;
  IsStopping: boolean;
  IsCancelled: boolean;
  IsOverride: boolean;
  Code: string;
  ActualTime: string | null;
  ServiceType: string;
}

export interface RawExceptionTrip {
  TripNumber: string;
  TripName: string;
  IsCancelled: boolean;
  IsOverride: boolean;
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
