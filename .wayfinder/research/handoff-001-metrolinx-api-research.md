# Metrolinx Open Data API — Inventory & Access Research (Ticket 001)

Research date: 2026-07-16. All facts below were pulled directly from pages fetched under `api.openmetrolinx.com`, `gotransit.com`, `metrolinx.com`, and PDFs those sites link to, except where marked "empirically confirmed" — those were verified the same day with a live, real Access Key issued to this project, since the Help site itself never documents the key mechanism. Every claim carries an inline citation to the exact page it came from, or is labeled as an empirical/live-test result. Where the official sites are silent, that is stated explicitly rather than inferred. Deliberately **not** tested: numeric rate limits — Metrolinx can disable keys for "excessive usage" and the limit is undisclosed, so this project chose not to probe it; see ticket 001 for the decision to defer that to separate research if it ever becomes an operational issue.

## 1. Summary

The **GO API** (Metrolinx Open Data API) is a REST-ish ASP.NET Web API exposing near-real-time and static reference data for GO Transit (rail + bus) and UP Express: stop/station info, next-service predictions, full schedules/journey planning, service alerts, fares, fleet consist/occupancy, and standard GTFS-realtime feeds (VehiclePositions, TripUpdates, ServiceAlerts) in JSON, XML, and (for the GTFS-shaped endpoints) protobuf. [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)

- **Access**: Free, but requires manual registration (business contact form) to obtain a permanent Access Key; approval can take up to 10 business days. [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en) · [(registration form)](https://api.openmetrolinx.com/OpenDataAPI/Help/Registration/en)
- **Cost**: Free — "Accessing the API is free, but you must register to obtain an Access Key." [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)
- **Rate limits**: No numeric limit (requests/sec/min/day) is published anywhere on the official site. However, the official API Data Catalogue documents an HTTP 429 "Too Many Requests" response defined as "the request cannot be served because key's use limit has been reached," confirming a per-key quota exists even though its size is never disclosed. Treat this as **undocumented** for planning purposes. [(source, error code table)](https://api.openmetrolinx.com/OpenDataAPI/Content/API_Data_Catalogue.pdf) (PDF p.9)
- **Formats**: JSON and XML on essentially every endpoint (selectable via file-extension suffix, e.g. `api/V1/Stop.json` vs `api/V1/Stop.xml`, or Accept header — see §3); the three "raw" `GTFS Feeds` endpoints (`api/V1/Gtfs/Feed/*`) additionally support `application/x-protobuf`. The UP-branded and Fleet-Occupancy GTFS-realtime endpoints only show JSON/XML samples on their Help pages (protobuf not demonstrated there). [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)
- **Auth mechanism (empirically confirmed 2026-07-16)**: the Access Key is passed as a `?key=` query parameter, e.g. `GET .../api/V1/Stop/All?key=<key>`. Verified against a live key: request with a valid key returns `Metadata.ErrorCode: "200"`; request with no key or a garbage key both return **transport-level HTTP 200** with `Metadata.ErrorCode: "401", ErrorMessage: "Unauthorized"` and a null payload — the API does not use real HTTP status codes for auth failures, only the body's `Metadata.ErrorCode`. See §3 and §4 for detail. This was undocumented on any Help page (see gap noted in the original pass below) and required live testing to confirm — not a claim from a fetched doc page.
- **Sandbox**: None found or referenced anywhere on the official site.
- **Versioning**: Every path is prefixed `V1`; no `V2`, changelog, or deprecation notice exists on the Help site. The Data Catalogue PDF's error table does define a `410 Gone — "The API version no longer exists. Use the current version"` code, implying Metrolinx has designed for future versioning even though none has shipped. [(source)](https://api.openmetrolinx.com/OpenDataAPI/Content/API_Data_Catalogue.pdf) (PDF p.9)

## 2. Endpoint inventory

All endpoints are `GET`, rooted at `https://api.openmetrolinx.com/OpenDataAPI/`. Every entry below was fetched individually from its own Help page at `https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/<slug>`; that URL is the citation for the row unless noted otherwise. Field-level descriptions/data types are cross-confirmed against the official **API Data Catalogue PDF** (dated 2018-07-11) where useful — noted as "(Catalogue)". The Catalogue is stale in places (see §4), so the Help pages are the primary source of truth for what the live API returns today.

### 2.1 Stop (`api/V1/Stop/...`)

Section description: "Returns information on Stops." [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)

| Endpoint | Params | Response shape |
|---|---|---|
| `GET api/V1/Stop/NextService/{StopCode}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Stop-NextService-StopCode) | `StopCode` (string, required) — "The stop for which the line predictions are required" | `Metadata{TimeStamp,ErrorCode,ErrorMessage}` + `NextService.Lines[]` each with `StopCode, LineCode, LineName, ServiceType(T/B), DirectionCode, DirectionName, ScheduledDepartureTime, ComputedDepartureTime, DepartureStatus(E/C/A), ScheduledPlatform, ActualPlatform, TripOrder, TripNumber, UpdateTime, Status(S/M), Latitude, Longitude`. |
| `GET api/V1/Stop/Details/{StopCode}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Stop-Details-StopCode) | `StopCode` (string) | `Stop{ZoneCode, StreetNumber, Intersection, City, StreetName, Code, StopName, StopNameFr, IsBus, IsTrain, Longitude, Latitude, DrivingDirections(+Fr), BoardingInfo(+Fr), TicketSales(+Fr), Facilities[]{Code,Description,DescriptionFr}, Parkings[]{Name,NameFr,ParkSpots,Type}, Place{Code,Name,Longitude,Latitude,Radius,Stops[]{Code,Name,NameFr}}}`. |
| `GET api/V1/Stop/Destinations/{StopCode}/{FromTime}/{ToTime}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Stop-Destinations-StopCode-FromTime-ToTime) | `StopCode` (required), `FromTime` (required, e.g. `0800`=8am — Catalogue), `ToTime` (required, e.g. `1300`=1pm — Catalogue) | `Stop{Code,Name,Line[]{Code,Display,Direction,DestinationStop}}`. Root element in XML is `<ResultDestinations>`, unlike most other endpoints' `<Result>`. |
| `GET api/V1/Stop/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Stop-All) | none | `Stations.Station[]{LocationCode, PublicStopId, LocationName, LocationType}`. `LocationType` values per Catalogue: BS/BT/CL/GT/PK/PR/ST/TA/TB/TS/TT; excludes internal BW/GR/WP/YD points. `PublicStopId` is the 6-digit code used elsewhere for bus-stop lookups. |

### 2.2 Service Update (`api/V1/ServiceUpdate/...`)

Section description: "Returns information on Alert messages, train or bus departures from Union and Service Guarantee for the trip." [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)

| Endpoint | Params | Response shape |
|---|---|---|
| `GET api/V1/ServiceUpdate/ServiceAlert/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceUpdate-ServiceAlert-All) | none | `Messages.Message[]{Code, ParentCode, Status(INIT/CORR/FINAL/UPD), PostedDateTime, SubjectEnglish/French, BodyEnglish/French, Category, SubCategory, Lines[]{Code}, Stops[]{Name,Code}, Trips[]{TripNumber}}`. Sourced from CCMS with `messageClass="SRVALERT"` (Catalogue). |
| `GET api/V1/ServiceUpdate/InformationAlert/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceUpdate-InformationAlert-All) | none | Identical shape to ServiceAlert; `messageClass="INFALERT"` (Catalogue). |
| `GET api/V1/ServiceUpdate/MarketingAlert/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceUpdate-MarketingAlert-All) | none | Identical shape; `messageClass="MKALERT"` (Catalogue). |
| `GET api/V1/ServiceUpdate/UnionDepartures/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceUpdate-UnionDepartures-All) | none | "Nearest departures for buses and trains from Union Station." `AllDepartures.Trip[]{Info, TripNumber, Platform, Service, ServiceType(T/B), Time, Stops[]{Name,Code}}`. |
| `GET api/V1/ServiceUpdate/ServiceGuarantee/{TripNumber}/{OperationalDay}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceUpdate-ServiceGuarantee-TripNumber-OperationalDay) | `TripNumber` (string), `OperationalDay` (`yyyymmdd`) | `Stops.Stop[]{Code, Scope, ReasonEn, ReasonFr}` — where a fare/service guarantee applied for that trip/day. |
| `GET api/V1/ServiceUpdate/Exceptions/Train` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceUpdate-Exceptions-Train) | none | "Schedule exceptions - cancelled trips/stops etc." `Trip[]{TripNumber, TripName, IsCancelled, IsOverride, Stop[]{Order, ID, SchArrival, SchDeparture, Name, IsStopping, IsCancelled, IsOverride, Code, ActualTime, ServiceType}}`. |
| `GET api/V1/ServiceUpdate/Exceptions/Bus` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceUpdate-Exceptions-Bus) | none | Identical shape to Exceptions/Train, bus-scoped. |
| `GET api/V1/ServiceUpdate/Exceptions/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceUpdate-Exceptions-All) | none | Identical shape, combined train+bus. |

### 2.3 Service At Glance (`api/V1/ServiceataGlance/...`)

Section description: "Returns information on service bus and train trips." [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)

| Endpoint | Params | Response shape |
|---|---|---|
| `GET api/V1/ServiceataGlance/Buses/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceataGlance-Buses-All) | none | "All in-service bus trips." `Trips.Trip[]{BusType(Double Decker/Coach), TripNumber, StartTime, EndTime, LineCode, RouteNumber, VariantDir, Display, Latitude, Longitude, IsInMotion, DelaySeconds, Course, FirstStopCode, LastStopCode, PrevStopCode, NextStopCode, AtStationCode, ModifiedDate, OccupancyPercentage}`. This is essentially a live vehicle-position + delay feed. |
| `GET api/V1/ServiceataGlance/Trains/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceataGlance-Trains-All) | none | Same shape, with `Cars` (e.g. "6"/"10"/"12") instead of `BusType`. |
| `GET api/V1/ServiceataGlance/UPX/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-ServiceataGlance-UPX-All) | none | Same shape as Trains/All, scoped to UP Express. |

### 2.4 Schedule (`api/V1/Schedule/...`)

Section description: "Returns information on Schedules by Line, Schedules by Stop and Journey." [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)

| Endpoint | Params | Response shape |
|---|---|---|
| `GET api/V1/Schedule/Journey/{Date}/{FromStopCode}/{ToStopCode}/{StartTime}/{MaxJourney}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Schedule-Journey-Date-FromStopCode-ToStopCode-StartTime-MaxJourney) | `Date` (`yyyymmdd`), `FromStopCode`, `ToStopCode`, `StartTime` (e.g. `0900`), `MaxJourney` (int, defaults to 3 — Help page) | This is the trip-planning endpoint. `SchJourneys[]{Date, Time, To, From, Services[]{Colour, Type(R/B/RB), Direction, Code, StartTime, EndTime, Duration, Accessible(R/B/RB), Trips.Trip[]{Number, Display, Line, Direction, LineVariant, Type, Stops.Stop[]{Code, Order, Time, sortingTime, IsMajor}, destinationStopCode, departFromCode, departFromAlternativeCode, departFromTimingPoint, tripPatternId}, Transfers[]{Code,Order,Time}, TransferLinks[]{FromTrip,FromStopCode,ToTrip,ToStopCode,TransferDuration}}}`. |
| `GET api/V1/Schedule/Journey/{Date}/{FromStopCode}/{StartTime}/{MaxJourney}?ToStopCode={ToStopCode}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Schedule-Journey-Date-FromStopCode-StartTime-MaxJourney_ToStopCode) | Same as above but `ToStopCode` moves to an optional **query string** parameter — i.e. journeys FROM a stop with no fixed destination (browse-all-destinations mode) when omitted. | Identical response shape to the above. This confirms the API does support query-string parameters (not just route segments) on at least this endpoint. |
| `GET api/V1/Schedule/Line/{Date}/{LineCode}/{LineDirection}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Schedule-Line-Date-LineCode-LineDirection) | `Date`, `LineCode`, `LineDirection` | `Lines.Line[]{Code, Direction, Type, Trip[]{Number, Display, Stops[]{Code,Order,Time,sortingTime,IsMajor}}}`. |
| `GET api/V1/Schedule/Line/All/{Date}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Schedule-Line-All-Date) | `Date` | "Lines in effect for the date provided." `AllLines.Line[]{Name, Code, IsBus, IsTrain, Variant[]{Code,Display,Direction}}`. |
| `GET api/V1/Schedule/Line/Stop/{Date}/{LineCode}/{LineDirection}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Schedule-Line-Stop-Date-LineCode-LineDirection) | `Date`, `LineCode`, `LineDirection` | `Lines{Code, Direction, Display, Stop[]{Code,Order,Name,Type,IsMajor}}`. |
| `GET api/V1/Schedule/Trip/{Date}/{TripNumber}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Schedule-Trip-Date-TripNumber) | `Date`, `TripNumber` | `Trips[]{Number, Destination, Longitude, Latitude, Status, TimeStamp, Stops[]{ArrivalTime{Scheduled,Computed,Status}, DepartureTime{Scheduled,Computed,Status}, Track{Scheduled,Actual}, Code, Status, Remark}}`. |

### 2.5 GTFS Feeds (`api/V1/Gtfs/Feed/...`)

Section description: "Returns GTFS real time feeds. Requests with `api/V1/Gtfs.xml` or `api/V1/Gtfs.json` or `api/V1/Gtfs.proto` or `api/V1/Gtfs` displays data in xml, json and protobuffer format respectively." [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)

| Endpoint | Params | Response shape |
|---|---|---|
| `GET api/V1/Gtfs/Feed/Alerts` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Gtfs-Feed-Alerts) | none | Standard GTFS-realtime `FeedMessage`: `header{gtfs_realtime_version, incrementality(FULL_DATASET), timestamp, feed_version}` + `entity[]` of Alert objects (cause/effect/active_period/informed_entity/header_text/description_text — full field set documented in Catalogue §2.7.5). |
| `GET api/V1/Gtfs/Feed/TripUpdates` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Gtfs-Feed-TripUpdates) | none | GTFS-realtime `FeedMessage` with `entity[]` of TripUpdate objects (trip_id/route_id/direction_id/start_time/start_date, vehicle, stop_time_update[] with arrival/departure delay or absolute time). |
| `GET api/V1/Gtfs/Feed/VehiclePosition` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Gtfs-Feed-VehiclePosition) | none | GTFS-realtime `FeedMessage` with `entity[]` of VehiclePosition objects (trip, vehicle{id,label,license_plate}, position{latitude,longitude,bearing,odometer,speed}, stop_id, current_status, congestion_level, occupancy_status). |

These three are the only endpoints on the site whose Help pages actually show a `application/x-protobuf` sample block, confirming true protobuf support here (source: raw fetch of each page). The equivalently-shaped `UP/Gtfs/Feed/*` and `Fleet/Occupancy/GtfsRT/Feed/*` endpoints below only show JSON/XML samples on their Help pages even though the section intro text for UPGTFSRealTimeV1 also claims `.proto` support — see §4 (quirks).

### 2.6 UPGTFSRealTimeV1 (`api/V1/UP/Gtfs/Feed/...`)

Section description: "Returns GTFS real time feeds. Requests with `api/UP/Gtfs.xml` or `api/UP/Gtfs.json` or `api/UP/Gtfs.proto` or `api/UP/Gtfs` displays data in xml, json and protobuffer format respectively." [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en) — same GTFS-realtime shapes as §2.5, scoped to UP Express only.

| Endpoint | Response shape |
|---|---|
| `GET api/V1/UP/Gtfs/Feed/Alerts` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-UP-Gtfs-Feed-Alerts) | GTFS-realtime FeedMessage (Alerts), UP-scoped. |
| `GET api/V1/UP/Gtfs/Feed/TripUpdates` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-UP-Gtfs-Feed-TripUpdates) | GTFS-realtime FeedMessage (TripUpdates), UP-scoped. |
| `GET api/V1/UP/Gtfs/Feed/VehiclePosition` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-UP-Gtfs-Feed-VehiclePosition) | GTFS-realtime FeedMessage (VehiclePosition), UP-scoped. |

### 2.7 Fleet (`api/V1/Fleet/...`)

Section description: "Returns GTFS real time feeds with Occupancy percentage and Consist information. ... The default return type is json for `api/V1/Fleet`." [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)

| Endpoint | Params | Response shape |
|---|---|---|
| `GET api/V1/Fleet/Consist/All` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Fleet-Consist-All) | none | `AllConsists.Consists[]{Number, CoachCount, EngineNumber, Lineup[]{Type,Order,Number}, RemainingTrip[]{Number,Corridor,StartTime,EndTime,FirstStop,LastStop,InService}}` — physical train-consist makeup. |
| `GET api/V1/Fleet/Consist/Engine/{EngineNumber}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Fleet-Consist-Engine-EngineNumber) | `EngineNumber` (string) | Same `AllConsists` shape, filtered to one engine. |
| `GET api/V1/Fleet/Occupancy/GtfsRT/Feed/Alerts` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Fleet-Occupancy-GtfsRT-Feed-Alerts) | none | GTFS-realtime FeedMessage shape (Alerts), Fleet-Occupancy branded. |
| `GET api/V1/Fleet/Occupancy/GtfsRT/Feed/TripUpdates` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Fleet-Occupancy-GtfsRT-Feed-TripUpdates) | none | GTFS-realtime FeedMessage shape (TripUpdates). |
| `GET api/V1/Fleet/Occupancy/GtfsRT/Feed/VehiclePosition` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Fleet-Occupancy-GtfsRT-Feed-VehiclePosition) | none | GTFS-realtime FeedMessage shape (VehiclePosition), the one where `occupancy_status`/`occupancy_percentage` is populated per the section description. |

### 2.8 Fare (`api/V1/Fares/...`)

Section description: "Returns information on Fares between stations." [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)

| Endpoint | Params | Response shape |
|---|---|---|
| `GET api/V1/Fares/{FromStopCode}/{ToStopCode}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Fares-FromStopCode-ToStopCode) | `FromStopCode`, `ToStopCode` | `AllFares.FareCategory[]{Type(Adult/Student/Senior/Child/Group Pass — Catalogue), Tickets[]{Type(Paper/Presto — Catalogue), Fares[]{Type, Amount, Category(Normal/Discount — Catalogue)}}}`. |
| `GET api/V1/Fares/{FromStopCode}/{ToStopCode}/{OperationalDay}` [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Fares-FromStopCode-ToStopCode-OperationalDay) | `FromStopCode`, `ToStopCode`, `OperationalDay` (`yyyymmdd`) | Identical `AllFares` shape, for a specific operational day. |

## 3. Response formats and how to select one

- Every non-GTFS-shaped endpoint's Help page shows two "Response Formats" blocks: `application/json, text/json` and `text/xml`. [(example source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Stop-NextService-StopCode)
- The three plain `GTFS Feeds` endpoints additionally show an `application/x-protobuf` sample. [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Gtfs-Feed-Alerts)
- The section intro text on the index page documents an explicit **file-extension** selection mechanism per section, e.g. for Stop: `"api/V1/Stop.xml"` or `"api/V1/Stop.json"` or `"api/V1/Stop"` (unsuffixed) "displays data in xml and json format respectively"; for GTFS Feeds: `.xml`/`.json`/`.proto`/unsuffixed; for Fleet: `.xml`/`.json`/`.proto`, with JSON as the documented default for the unsuffixed form. [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en) The individual endpoint Help pages do not show the extension in the URL template shown at the top of the page (e.g. `api/V1/Stop/NextService/{StopCode}`), so the exact suffix point (end of path vs. before route params) is **not fully unambiguous from the primary source** — treat the section-intro examples as the authoritative pattern (suffix appended to the resource root, e.g. `api/V1/Stop.json`, not to each parameterized method).
- Since this is a standard ASP.NET Web API "Help Page" auto-generated site, the two `Response Formats` blocks per endpoint (`application/json, text/json` and `text/xml`) are consistent with standard `Accept`-header content negotiation being available as an alternative to the extension suffix, but the official Help site does not explicitly document the `Accept` header as a selection mechanism anywhere I found — this is inferred from the ASP.NET Web API Help Page convention, not confirmed by an explicit statement on the site. Flagging this as **not fully documented** rather than asserting it as fact.
- **Empirically confirmed (2026-07-16), with a live key against `Stop/All` and `Stop.xml`**: the documented file-extension suffix pattern (`api/V1/Stop.xml`, `api/V1/Stop/All.xml`) does **not** work on the live API — both returned a real HTTP 404. The **`Accept` header does work**: `Accept: text/xml` on the plain unsuffixed URL returns a proper XML document; omitting it (or sending `Accept: application/json`) returns JSON. Treat the Help site's suffix examples as stale/aspirational documentation and use the `Accept` header as the actual format-selection mechanism. Not verified against every endpoint family (only `Stop/All`), but there's no reason to expect other sections to differ since they share the same ASP.NET Web API pipeline.

## 4. Known quirks / deprecated / version notes

- **No API key parameter is documented anywhere on the Help site.** None of the 34 endpoint Help pages list a `key`/`apikey`/`access_key` entry in their "URI Parameters" or "Body Parameters" tables, and no Help page or the registration page documents the exact query-string name, header name, or placement for the Access Key issued at registration. [(registration page, no key-usage documentation)](https://api.openmetrolinx.com/OpenDataAPI/Help/Registration/en) **Resolved empirically (2026-07-16)** against a live issued key: it's a `?key=<value>` query parameter (confirmed working on `Stop/All`); a missing or invalid key does *not* produce a real HTTP 401 — it produces transport-level **HTTP 200** with `Metadata{ErrorCode:"401", ErrorMessage:"Unauthorized"}` and a null payload (e.g. `Stations: null`). Any client/wrapper must check `Metadata.ErrorCode` in the body rather than trusting the HTTP status code for auth failures — this is a real footgun for a naive HTTP-status-only error handler. (Genuinely malformed routes, e.g. a bad format suffix, do return a real transport 404 — so error signaling is inconsistent between "route not found" and "auth failed.")
- **No `V2` exists.** Every path is `api/V1/...`. No changelog, deprecation notice, or forward-compatibility statement appears on the Help site. The only versioning-related artifact is the `410 Gone` error code definition in the Data Catalogue PDF ("The API version no longer exists. Use the current version."), which implies the *design* anticipates future versions but none has been observed. [(source)](https://api.openmetrolinx.com/OpenDataAPI/Content/API_Data_Catalogue.pdf) (PDF p.9)
- **The official API Data Catalogue PDF (dated 2018-07-11) is stale relative to the live Help site.** Its table of contents lists only 6 top-level sections (Stop Service, ServiceUpdate, ServiceataGlance, Schedule, FaresService, GTFS Feeds) and does not mention `Fleet` (Consist/Occupancy) or the `UPGTFSRealTimeV1` section, nor `ServiceataGlance/UPX`, all of which are live on the current Help index. Use the Catalogue only for field-level enrichment of the sections it does cover; treat the live Help pages (`/Help/Api/en/...`) as authoritative for what currently exists. [(source: catalogue ToC)](https://api.openmetrolinx.com/OpenDataAPI/Content/API_Data_Catalogue.pdf) vs [(source: live index)](https://api.openmetrolinx.com/OpenDataAPI/Help/Index/en)
- **Protobuf support is inconsistent across otherwise-identical GTFS-realtime endpoint families.** `api/V1/Gtfs/Feed/*` Help pages show a working protobuf sample block; the parallel `api/V1/UP/Gtfs/Feed/*` and `api/V1/Fleet/Occupancy/GtfsRT/Feed/*` Help pages do not display one (JSON/XML only), even though the UPGTFSRealTimeV1 section's intro text claims `.proto` is supported. This may just be a Help-page generation quirk rather than an actual capability gap — not resolvable without live-testing a `.proto` request against those specific paths.
- **Two different shapes exist for `ScheduleJourney`** depending on whether `ToStopCode` is supplied as a route segment or a query-string parameter (`.../{StartTime}/{MaxJourney}?ToStopCode={ToStopCode}`), the latter presumably used to browse all reachable destinations from a stop without pre-selecting one. Both are separately documented Help pages with identical response shapes. [(source 1)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Schedule-Journey-Date-FromStopCode-ToStopCode-StartTime-MaxJourney) [(source 2)](https://api.openmetrolinx.com/OpenDataAPI/Help/Api/en/GET-api-V1-Schedule-Journey-Date-FromStopCode-StartTime-MaxJourney_ToStopCode)
- **XML root element names are inconsistent** across endpoints — most are `<Result>`, but `Stop/Destinations` uses `<ResultDestinations>` and the raw GTFS feeds use `<feedMessage>`. Worth normalizing in any wrapper.
- **`Time`/date fields are loosely typed as strings in the JSON samples** (e.g. `"Time": ""` in UnionDepartures, `null` for `ScheduledDepartureTime`/`ComputedDepartureTime` in NextService) rather than strict ISO 8601 — the Help page auto-generated samples show placeholder/null values, so real response formatting should be verified empirically once a key is available.

## 5. Terms of service considerations for an open-source wrapper

The `api.openmetrolinx.com` Help site itself does **not** publish its own terms of service, license, or usage-restriction text on any page I could find (index, registration, or individual endpoint pages). The closest official governing documents I could locate, both off the API host itself:

1. **Open Government Licence – Ontario – Metrolinx** (v1.0), linked from Metrolinx's own Open Data page. [(source, PDF)](https://assets.metrolinx.com/image/upload/v1663237565/Documents/Metrolinx/Open-Government-Licence-Ontario-Metrolinx.pdf) — linked to from [metrolinx.com/en/about-us/open-data](https://www.metrolinx.com/en/about-us/open-data). This is genuinely permissive and favorable for an open-source project:
   - Grants a **"worldwide, royalty-free, perpetual, non-exclusive licence to use the Information, including for commercial purposes."** (§2)
   - You are free to **"copy, modify, publish, translate, adapt, distribute or otherwise use the Information in any medium, mode or format for any lawful purpose."** (§3) — this explicitly covers redistribution/wrapping.
   - Requires **attribution**: either a provider-specified statement or, by default, the text **"Contains information licensed under the Open Government Licence - Ontario - Metrolinx."** with a link to the licence where possible. (§4)
   - Excludes personal information, non-FOI-accessible records, third-party rights Metrolinx isn't authorized to license, Metrolinx's names/crests/logos, and other IP (patents/trademarks). (§6)
   - Forbids implying official status or Metrolinx endorsement of your product. (§7)
   - Data is licensed **"as is"** with liability fully disclaimed; Ontario law governs, Ontario courts have exclusive jurisdiction. (§8–11)
   - **Important caveat**: this licence is referenced from the general Metrolinx Open Data landing page (which also links the static GTFS zip downloads), not from `api.openmetrolinx.com` itself. I found **no explicit statement on the API Help site** that this specific licence governs responses returned by the live `api/V1/...` endpoints as opposed to just the downloadable datasets/GTFS files listed on the Metrolinx open-data page. Treat "the OGL applies to the live API" as a reasonable but **unconfirmed inference**, not a directly-sourced fact — worth clarifying with Metrolinx directly (`OpenData.Program@metrolinx.com`, per the Open Data page) before publishing an open-source wrapper.

2. **GO Transit "Access and Use Agreement"** — the [Software Developers partner page](https://www.gotransit.com/en/partner-with-us/software-developers) states GTFS (static) downloads require accepting an "Access and Use Agreement" before the zip files download. I was not able to retrieve the full text of this agreement (it appears to be a click-through gate on the download links themselves, e.g. [GO-GTFS.zip](https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip) / [UP-GTFS.zip](https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/UP-GTFS.zip)), and it may impose terms distinct from (and possibly stricter than) the OGL. This is a **gap**: the exact text of this agreement was not accessible via a plain fetch and should be reviewed manually (e.g. by clicking through the download flow in a browser) before redistributing any data sourced via that path. The general [gotransit.com Terms and Conditions](https://www.gotransit.com/en/terms-and-conditions) page does not mention the API, GTFS, or an "Access and Use Agreement" at all — it's scoped to fares/tickets/service-guarantee/social-media conduct.

3. **API registration itself is gated by manual approval** with a business-justification field ("Intended Use"), which means Metrolinx reviews and can presumably reject or condition access for a given use case — relevant if this project later wants to redistribute a hosted MCP server that proxies live calls under one shared key (multi-tenant use) rather than requiring each user to register their own key. Nothing on the registration page addresses whether key-sharing / proxying is permitted or prohibited. [(source)](https://api.openmetrolinx.com/OpenDataAPI/Help/Registration/en)

4. The Data Catalogue's error-code table confirms Metrolinx can and does **disable keys for "excessive usage"** (see index page quote in §1) and revoke/reissue on compromise — worth building conservative client-side caching/backoff into any wrapper regardless of the unknown numeric limit.

**Net assessment**: the data itself is licensed in an open, redistribution-friendly way (OGL, commercial use OK, attribution required) *if* that licence is confirmed to cover live API responses and not just the static downloads — this should be confirmed with Metrolinx before shipping. The API *access* (the key) has stricter, discretionary gating (manual review, revocable for abuse) that's independent of the data licence.

## 6. Webhook / push / subscription mechanism

None found. Every endpoint on the Help site is a `GET` request returning current state — including the GTFS-realtime "feeds," which are pull/poll-based snapshots (`FeedMessage` with `incrementality: FULL_DATASET`, i.e. each poll returns the complete current dataset, not a delta) rather than a push mechanism. [(source)](https://api.openmetrolinx.com/OpenDataAPI/Content/API_Data_Catalogue.pdf) (PDF p.77, `Incrementality` field description: "Differential... currently, this mode is not supported"). No webhook registration, callback URL, MQTT/WebSocket, or subscription endpoint exists anywhere in the enumerated 34-endpoint list or on the index/registration pages. Everything must be polled.

## 7. Candidates for MCP Tools vs Resources vs Prompts

This section is my own reasoning based on the endpoint inventory above, not a sourced fact — flagged accordingly.

### Tools (LLM actively invokes with parameters, for time-sensitive or query-specific answers)

- `Schedule/Journey/*` (both variants) — trip planning ("how do I get from A to B"), the highest-value tool for this project's stated purpose.
- `Stop/NextService/{StopCode}` — "when's the next train/bus at this stop" (real-time).
- `Stop/Destinations/{StopCode}/{FromTime}/{ToTime}` — "where can I go from here in this window."
- `ServiceUpdate/UnionDepartures/All` — real-time Union Station departure board.
- `ServiceUpdate/ServiceGuarantee/{TripNumber}/{OperationalDay}` — trip-specific lookup.
- `ServiceUpdate/Exceptions/{Train,Bus,All}` — "is my trip affected by a cancellation today" (time-sensitive, changes daily).
- `ServiceataGlance/{Buses,Trains,UPX}/All` — live vehicle positions/delays (changes constantly; a tool query, not a cacheable resource).
- `Fares/{FromStopCode}/{ToStopCode}[/{OperationalDay}]` — "how much will this trip cost."
- `Schedule/Trip/{Date}/{TripNumber}` — specific trip status lookup.
- `Fleet/Consist/{All,Engine/{EngineNumber}}` — live consist lookup (niche but time-sensitive).
- The three GTFS-realtime feed families (`Gtfs/Feed/*`, `UP/Gtfs/Feed/*`, `Fleet/Occupancy/GtfsRT/Feed/*`) — better modeled as tools an LLM calls on demand for a fresh snapshot rather than resources, since `incrementality: FULL_DATASET` means there's no meaningful "current state" to cache client-side beyond a short TTL.

### Resources (fairly static/slowly-changing reference data — good candidates for pre-fetching, caching, or exposing as MCP resources rather than live tool calls)

- `Stop/All` — the full station/stop list; changes rarely (new stations opening).
- `Stop/Details/{StopCode}` — station facilities/parking/location metadata; changes infrequently. Could be a resource keyed by stop code, or bulk-fetched and served as one large resource.
- `Schedule/Line/All/{Date}` and `Schedule/Line/{Date}/{LineCode}/{LineDirection}` and `Schedule/Line/Stop/{Date}/{LineCode}/{LineDirection}` — the published schedule for a given service day; effectively static once a day's schedule is published (bulk-fetchable, good caching candidate even though it's parameterized by date).
- `ServiceUpdate/ServiceAlert/All`, `InformationAlert/All`, `MarketingAlert/All` — arguably borderline: alerts change during the day but are lower-frequency than vehicle positions; could be either a short-TTL-cached resource or a tool, depending on desired freshness. Leaning tool given the "have I been affected right now" use case.

### Prompts

Few to none map naturally from this endpoint inventory — the API surface is pure data retrieval, not a conversational or workflow API. The one plausible prompt template is a **"plan my GO Transit trip"** prompt that pre-fills the multi-step flow of resolving human-readable station names → stop codes (via a resource lookup against `Stop/All`) → calling `Schedule/Journey` → summarizing `Services`/`Trips`/`Transfers` in natural language, since that composition (name resolution + journey call + explanation) is the kind of multi-tool orchestration prompts are meant to scaffold. Beyond that, this API doesn't expose anything (e.g. no free-text search, no user accounts, no personalization) that would justify additional prompt templates.
