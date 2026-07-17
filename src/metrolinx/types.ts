// Raw Metrolinx response shapes, PascalCase exactly as delivered upstream.
// Hand-modeled from the Data Catalogue for the tracer slice; to be verified
// and expanded against captured live fixtures (issue #3).

export interface RawMetadata {
  TimeStamp: string;
  ErrorCode: string;
  ErrorMessage: string;
}

export interface RawParkingLot {
  Name: string;
  SpacesTotal?: number | null;
  Type?: string | null;
}

export interface RawStop {
  LocationCode: string;
  LocationName: string;
  LocationType: string;
  City?: string | null;
  Latitude: number;
  Longitude: number;
  IsBus: boolean;
  IsTrain: boolean;
  Facilities?: string[] | null;
  ParkingLots?: RawParkingLot[] | null;
  AccessibilityInfo?: string | null;
  BoardingInfo?: string | null;
  DrivingDirections?: string | null;
}

export interface RawStopDetailsResponse {
  Metadata: RawMetadata;
  Stop?: RawStop | null;
}
