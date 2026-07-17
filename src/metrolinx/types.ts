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
