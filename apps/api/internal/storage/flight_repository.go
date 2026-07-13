package storage

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/twotwobread/i-um/apps/api/internal/db"
	"github.com/twotwobread/i-um/apps/api/internal/flight"
)

func (s *Store) GetTripParticipantID(ctx context.Context, tripID string, userID string) (string, error) {
	row, err := s.queries.GetTripParticipantMembership(ctx, db.GetTripParticipantMembershipParams{Column1: mustUUID(tripID), Column2: mustUUID(userID)})
	if err == pgx.ErrNoRows {
		return "", flight.ErrNotFound
	}
	if err != nil {
		return "", err
	}
	return row, nil
}

func (s *Store) CreateFlightWithPassengers(ctx context.Context, record flight.CreateFlightRecord) (flight.FlightDetail, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return flight.FlightDetail{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)
	created, err := qtx.CreateFlight(ctx, db.CreateFlightParams{
		TripID:               mustUUID(record.TripID),
		FlightNumber:         textPtrToSQL(record.FlightNumber),
		DisplayTitle:         record.DisplayTitle,
		DepartureAirportText: record.Departure.AirportText,
		DepartureAirportCode: textPtrToSQL(record.Departure.AirportCode),
		DepartureLocalDate:   dateFromString(record.Departure.LocalDate),
		DepartureLocalTime:   clockTimeFromString(record.Departure.LocalTime),
		DepartureTimeZone:    record.Departure.TimeZone,
		DepartureAt:          timestamptzValue(record.Departure.At),
		ArrivalAirportText:   record.Arrival.AirportText,
		ArrivalAirportCode:   textPtrToSQL(record.Arrival.AirportCode),
		ArrivalLocalDate:     dateFromString(record.Arrival.LocalDate),
		ArrivalLocalTime:     clockTimeFromString(record.Arrival.LocalTime),
		ArrivalTimeZone:      record.Arrival.TimeZone,
		ArrivalAt:            timestamptzValue(record.Arrival.At),
		CreatedByUserID:      mustUUID(record.CreatedByUserID),
	})
	if err != nil {
		return flight.FlightDetail{}, err
	}
	for _, passengerID := range record.PassengerIDs {
		if _, err := qtx.CreateFlightPassenger(ctx, db.CreateFlightPassengerParams{FlightID: mustUUID(created.ID), TripID: mustUUID(record.TripID), ParticipantID: mustUUID(passengerID), AddedByUserID: mustUUID(record.CreatedByUserID)}); err != nil {
			return flight.FlightDetail{}, err
		}
	}
	passengerRows, err := qtx.ListFlightPassengersByFlight(ctx, db.ListFlightPassengersByFlightParams{TripID: mustUUID(record.TripID), FlightID: mustUUID(created.ID)})
	if err != nil {
		return flight.FlightDetail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return flight.FlightDetail{}, err
	}
	return flight.FlightDetail{Flight: flightFromCreateRow(created), Passengers: passengersFromRows(passengerRows)}, nil
}

func (s *Store) ListFlights(ctx context.Context, tripID string, userID string) ([]flight.FlightDetail, error) {
	flightRows, err := s.queries.ListFlightsByTrip(ctx, mustUUID(tripID))
	if err != nil {
		return nil, err
	}
	passengerRows, err := s.queries.ListFlightPassengersByTrip(ctx, mustUUID(tripID))
	if err != nil {
		return nil, err
	}
	personalRows, err := s.queries.ListMyFlightPersonalDetailsByTrip(ctx, db.ListMyFlightPersonalDetailsByTripParams{TripID: mustUUID(tripID), UserID: mustUUID(userID)})
	if err != nil {
		return nil, err
	}

	passengersByFlight := map[string][]flight.Passenger{}
	for _, row := range passengerRows {
		passengersByFlight[row.FlightID] = append(passengersByFlight[row.FlightID], flight.Passenger{ParticipantID: row.ParticipantID, DisplayName: row.DisplayName})
	}
	personalByFlight := map[string]flight.PersonalDetail{}
	for _, row := range personalRows {
		detail := personalDetailFromListRow(row)
		personalByFlight[detail.FlightID] = detail
	}
	currentParticipantID, _ := s.GetTripParticipantID(ctx, tripID, userID)

	result := make([]flight.FlightDetail, 0, len(flightRows))
	for _, row := range flightRows {
		detail := flight.FlightDetail{Flight: flightFromListRow(row), Passengers: passengersByFlight[row.ID]}
		if personal, ok := personalByFlight[row.ID]; ok {
			detail.MyPersonalDetail = &personal
		} else if currentParticipantID != "" && passengerListContains(detail.Passengers, currentParticipantID) {
			personal := flight.PersonalDetail{FlightID: row.ID, TripID: tripID, PassengerParticipantID: currentParticipantID}
			detail.MyPersonalDetail = &personal
		}
		result = append(result, detail)
	}
	return result, nil
}

func (s *Store) GetFlight(ctx context.Context, tripID string, flightID string, userID string) (flight.FlightDetail, error) {
	row, err := s.queries.GetFlightByTrip(ctx, db.GetFlightByTripParams{TripID: mustUUID(tripID), FlightID: mustUUID(flightID)})
	if err == pgx.ErrNoRows {
		return flight.FlightDetail{}, flight.ErrNotFound
	}
	if err != nil {
		return flight.FlightDetail{}, err
	}
	passengerRows, err := s.queries.ListFlightPassengersByFlight(ctx, db.ListFlightPassengersByFlightParams{TripID: mustUUID(tripID), FlightID: mustUUID(flightID)})
	if err != nil {
		return flight.FlightDetail{}, err
	}
	result := flight.FlightDetail{Flight: flightFromGetRow(row), Passengers: passengersFromRows(passengerRows)}
	participantID, err := s.GetFlightPassengerParticipantID(ctx, tripID, flightID, userID)
	if err == nil {
		personal, err := s.queries.GetFlightPersonalDetail(ctx, db.GetFlightPersonalDetailParams{TripID: mustUUID(tripID), FlightID: mustUUID(flightID), PassengerParticipantID: mustUUID(participantID)})
		if err == nil {
			detail := personalDetailFromGetRow(personal)
			result.MyPersonalDetail = &detail
		} else if err == pgx.ErrNoRows {
			detail := flight.PersonalDetail{FlightID: flightID, TripID: tripID, PassengerParticipantID: participantID}
			result.MyPersonalDetail = &detail
		} else {
			return flight.FlightDetail{}, err
		}
	} else if !errors.Is(err, flight.ErrNotFound) {
		return flight.FlightDetail{}, err
	}
	return result, nil
}

func (s *Store) GetFlightPassengerParticipantID(ctx context.Context, tripID string, flightID string, userID string) (string, error) {
	participantID, err := s.queries.GetFlightPassengerParticipantForUser(ctx, db.GetFlightPassengerParticipantForUserParams{TripID: mustUUID(tripID), FlightID: mustUUID(flightID), UserID: mustUUID(userID)})
	if err == pgx.ErrNoRows {
		return "", flight.ErrNotFound
	}
	if err != nil {
		return "", err
	}
	return participantID, nil
}

func (s *Store) UpsertPersonalDetail(ctx context.Context, record flight.UpsertPersonalDetailRecord) (flight.PersonalDetail, error) {
	row, err := s.queries.UpsertFlightPersonalDetail(ctx, db.UpsertFlightPersonalDetailParams{
		FlightID:               mustUUID(record.FlightID),
		TripID:                 mustUUID(record.TripID),
		PassengerParticipantID: mustUUID(record.PassengerParticipantID),
		CreatedByUserID:        mustUUID(record.CreatedByUserID),
		ReservationNumber:      textPtrToSQL(record.ReservationNumber),
		Seat:                   textPtrToSQL(record.Seat),
		CheckInUrl:             textPtrToSQL(record.CheckInURL),
	})
	if err != nil {
		return flight.PersonalDetail{}, err
	}
	return personalDetailFromUpsertRow(row), nil
}

func (s *Store) UpsertBoardingPassMetadata(ctx context.Context, record flight.UpsertBoardingPassMetadataRecord) (flight.PersonalDetail, *flight.BoardingPassObject, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return flight.PersonalDetail{}, nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	qtx := s.queries.WithTx(tx)

	var oldObject *flight.BoardingPassObject
	locked, err := qtx.LockFlightPersonalDetailForUpdate(ctx, db.LockFlightPersonalDetailForUpdateParams{TripID: mustUUID(record.TripID), FlightID: mustUUID(record.FlightID), PassengerParticipantID: mustUUID(record.PassengerParticipantID)})
	if err == nil {
		oldObject = boardingPassObjectFromLockRow(locked)
	} else if err == pgx.ErrNoRows {
		if _, err := qtx.LockFlightPassengerForUpdate(ctx, db.LockFlightPassengerForUpdateParams{TripID: mustUUID(record.TripID), FlightID: mustUUID(record.FlightID), ParticipantID: mustUUID(record.PassengerParticipantID)}); err == pgx.ErrNoRows {
			return flight.PersonalDetail{}, nil, flight.ErrNotFound
		} else if err != nil {
			return flight.PersonalDetail{}, nil, err
		}
	} else {
		return flight.PersonalDetail{}, nil, err
	}

	row, err := qtx.UpsertFlightBoardingPassMetadata(ctx, db.UpsertFlightBoardingPassMetadataParams{
		FlightID:                mustUUID(record.FlightID),
		TripID:                  mustUUID(record.TripID),
		PassengerParticipantID:  mustUUID(record.PassengerParticipantID),
		CreatedByUserID:         mustUUID(record.CreatedByUserID),
		BoardingPassBucket:      textValue(record.Object.Bucket),
		BoardingPassObjectKey:   textValue(record.Object.ObjectKey),
		BoardingPassGeneration:  textPtrToSQL(record.Object.Generation),
		BoardingPassContentType: textValue(record.Object.ContentType),
		BoardingPassByteSize:    pgtype.Int4{Int32: int32(record.Object.ByteSize), Valid: true},
		BoardingPassUploadedAt:  timestamptzValue(record.Object.UploadedAt),
	})
	if err != nil {
		return flight.PersonalDetail{}, nil, err
	}
	if oldObject != nil {
		if err := createStorageObjectDeletionJob(ctx, qtx, *oldObject, "replace"); err != nil {
			return flight.PersonalDetail{}, nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return flight.PersonalDetail{}, nil, err
	}
	return personalDetailFromBoardingPassUpsertRow(row), oldObject, nil
}

func (s *Store) ClearBoardingPassMetadata(ctx context.Context, tripID string, flightID string, passengerParticipantID string) (*flight.BoardingPassObject, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	qtx := s.queries.WithTx(tx)
	locked, err := qtx.LockFlightPersonalDetailForUpdate(ctx, db.LockFlightPersonalDetailForUpdateParams{TripID: mustUUID(tripID), FlightID: mustUUID(flightID), PassengerParticipantID: mustUUID(passengerParticipantID)})
	if err == pgx.ErrNoRows {
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	oldObject := boardingPassObjectFromLockRow(locked)
	if oldObject == nil {
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return nil, nil
	}
	if _, err := qtx.ClearFlightBoardingPassMetadata(ctx, db.ClearFlightBoardingPassMetadataParams{TripID: mustUUID(tripID), FlightID: mustUUID(flightID), PassengerParticipantID: mustUUID(passengerParticipantID)}); err != nil {
		return nil, err
	}
	if err := createStorageObjectDeletionJob(ctx, qtx, *oldObject, "delete"); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return oldObject, nil
}

func (s *Store) GetBoardingPassObject(ctx context.Context, tripID string, flightID string, passengerParticipantID string) (flight.BoardingPassObject, error) {
	row, err := s.queries.GetFlightPersonalDetail(ctx, db.GetFlightPersonalDetailParams{TripID: mustUUID(tripID), FlightID: mustUUID(flightID), PassengerParticipantID: mustUUID(passengerParticipantID)})
	if err == pgx.ErrNoRows {
		return flight.BoardingPassObject{}, flight.ErrNotFound
	}
	if err != nil {
		return flight.BoardingPassObject{}, err
	}
	object := boardingPassObjectFromGetRow(row)
	if object == nil {
		return flight.BoardingPassObject{}, flight.ErrNotFound
	}
	return *object, nil
}

func flightFromCreateRow(row db.CreateFlightRow) flight.Flight {
	return flight.Flight{ID: row.ID, TripID: row.TripID, FlightNumber: textPtrFromSQL(row.FlightNumber), DisplayTitle: row.DisplayTitle, Departure: flightEndpoint(row.DepartureAirportText, row.DepartureAirportCode, row.DepartureLocalDate, row.DepartureLocalTime, row.DepartureTimeZone, row.DepartureAt), Arrival: flightEndpoint(row.ArrivalAirportText, row.ArrivalAirportCode, row.ArrivalLocalDate, row.ArrivalLocalTime, row.ArrivalTimeZone, row.ArrivalAt), CreatedByUserID: row.CreatedByUserID, CreatedAt: timeFromTimestamptz(row.CreatedAt), UpdatedAt: timeFromTimestamptz(row.UpdatedAt)}
}

func flightFromListRow(row db.ListFlightsByTripRow) flight.Flight {
	return flight.Flight{ID: row.ID, TripID: row.TripID, FlightNumber: textPtrFromSQL(row.FlightNumber), DisplayTitle: row.DisplayTitle, Departure: flightEndpoint(row.DepartureAirportText, row.DepartureAirportCode, row.DepartureLocalDate, row.DepartureLocalTime, row.DepartureTimeZone, row.DepartureAt), Arrival: flightEndpoint(row.ArrivalAirportText, row.ArrivalAirportCode, row.ArrivalLocalDate, row.ArrivalLocalTime, row.ArrivalTimeZone, row.ArrivalAt), CreatedByUserID: row.CreatedByUserID, CreatedAt: timeFromTimestamptz(row.CreatedAt), UpdatedAt: timeFromTimestamptz(row.UpdatedAt)}
}

func flightFromGetRow(row db.GetFlightByTripRow) flight.Flight {
	return flight.Flight{ID: row.ID, TripID: row.TripID, FlightNumber: textPtrFromSQL(row.FlightNumber), DisplayTitle: row.DisplayTitle, Departure: flightEndpoint(row.DepartureAirportText, row.DepartureAirportCode, row.DepartureLocalDate, row.DepartureLocalTime, row.DepartureTimeZone, row.DepartureAt), Arrival: flightEndpoint(row.ArrivalAirportText, row.ArrivalAirportCode, row.ArrivalLocalDate, row.ArrivalLocalTime, row.ArrivalTimeZone, row.ArrivalAt), CreatedByUserID: row.CreatedByUserID, CreatedAt: timeFromTimestamptz(row.CreatedAt), UpdatedAt: timeFromTimestamptz(row.UpdatedAt)}
}

func personalDetailFromUpsertRow(row db.UpsertFlightPersonalDetailRow) flight.PersonalDetail {
	return flight.PersonalDetail{ID: row.ID, FlightID: row.FlightID, TripID: row.TripID, PassengerParticipantID: row.PassengerParticipantID, CreatedByUserID: row.CreatedByUserID, ReservationNumber: textPtrFromSQL(row.ReservationNumber), Seat: textPtrFromSQL(row.Seat), CheckInURL: textPtrFromSQL(row.CheckInUrl), BoardingPass: boardingPassSummary(row.BoardingPassContentType, row.BoardingPassByteSize, row.BoardingPassUploadedAt), CreatedAt: timeFromTimestamptz(row.CreatedAt), UpdatedAt: timeFromTimestamptz(row.UpdatedAt)}
}

func personalDetailFromListRow(row db.ListMyFlightPersonalDetailsByTripRow) flight.PersonalDetail {
	return flight.PersonalDetail{ID: row.ID, FlightID: row.FlightID, TripID: row.TripID, PassengerParticipantID: row.PassengerParticipantID, CreatedByUserID: row.CreatedByUserID, ReservationNumber: textPtrFromSQL(row.ReservationNumber), Seat: textPtrFromSQL(row.Seat), CheckInURL: textPtrFromSQL(row.CheckInUrl), BoardingPass: boardingPassSummary(row.BoardingPassContentType, row.BoardingPassByteSize, row.BoardingPassUploadedAt), CreatedAt: timeFromTimestamptz(row.CreatedAt), UpdatedAt: timeFromTimestamptz(row.UpdatedAt)}
}

func personalDetailFromGetRow(row db.GetFlightPersonalDetailRow) flight.PersonalDetail {
	return flight.PersonalDetail{ID: row.ID, FlightID: row.FlightID, TripID: row.TripID, PassengerParticipantID: row.PassengerParticipantID, CreatedByUserID: row.CreatedByUserID, ReservationNumber: textPtrFromSQL(row.ReservationNumber), Seat: textPtrFromSQL(row.Seat), CheckInURL: textPtrFromSQL(row.CheckInUrl), BoardingPass: boardingPassSummary(row.BoardingPassContentType, row.BoardingPassByteSize, row.BoardingPassUploadedAt), CreatedAt: timeFromTimestamptz(row.CreatedAt), UpdatedAt: timeFromTimestamptz(row.UpdatedAt)}
}

func passengersFromRows(rows []db.ListFlightPassengersByFlightRow) []flight.Passenger {
	passengers := make([]flight.Passenger, 0, len(rows))
	for _, row := range rows {
		passengers = append(passengers, flight.Passenger{ParticipantID: row.ParticipantID, DisplayName: row.DisplayName})
	}
	return passengers
}

func passengerListContains(passengers []flight.Passenger, participantID string) bool {
	for _, passenger := range passengers {
		if passenger.ParticipantID == participantID {
			return true
		}
	}
	return false
}

func flightEndpoint(airportText string, airportCode pgtype.Text, localDate pgtype.Date, localTime pgtype.Time, timeZone string, at pgtype.Timestamptz) flight.FlightEndpoint {
	return flight.FlightEndpoint{AirportText: airportText, AirportCode: textPtrFromSQL(airportCode), LocalDate: dateString(localDate), LocalTime: clockTimeString(localTime), TimeZone: timeZone, At: timeFromTimestamptz(at)}
}

func personalDetailFromBoardingPassUpsertRow(row db.UpsertFlightBoardingPassMetadataRow) flight.PersonalDetail {
	return flight.PersonalDetail{ID: row.ID, FlightID: row.FlightID, TripID: row.TripID, PassengerParticipantID: row.PassengerParticipantID, CreatedByUserID: row.CreatedByUserID, ReservationNumber: textPtrFromSQL(row.ReservationNumber), Seat: textPtrFromSQL(row.Seat), CheckInURL: textPtrFromSQL(row.CheckInUrl), BoardingPass: boardingPassSummary(row.BoardingPassContentType, row.BoardingPassByteSize, row.BoardingPassUploadedAt), CreatedAt: timeFromTimestamptz(row.CreatedAt), UpdatedAt: timeFromTimestamptz(row.UpdatedAt)}
}

func boardingPassSummary(contentType pgtype.Text, byteSize pgtype.Int4, uploadedAt pgtype.Timestamptz) flight.BoardingPassSummary {
	if !contentType.Valid || !byteSize.Valid || !uploadedAt.Valid {
		return flight.BoardingPassSummary{}
	}
	contentTypePtr := contentType.String
	byteSizeValue := int(byteSize.Int32)
	uploadedAtValue := uploadedAt.Time.UTC()
	return flight.BoardingPassSummary{Exists: true, ContentType: &contentTypePtr, ByteSize: &byteSizeValue, UploadedAt: &uploadedAtValue}
}

func boardingPassObjectFromLockRow(row db.LockFlightPersonalDetailForUpdateRow) *flight.BoardingPassObject {
	return boardingPassObject(row.BoardingPassBucket, row.BoardingPassObjectKey, row.BoardingPassGeneration, row.BoardingPassContentType, row.BoardingPassByteSize, row.BoardingPassUploadedAt)
}

func boardingPassObjectFromGetRow(row db.GetFlightPersonalDetailRow) *flight.BoardingPassObject {
	return boardingPassObject(row.BoardingPassBucket, row.BoardingPassObjectKey, row.BoardingPassGeneration, row.BoardingPassContentType, row.BoardingPassByteSize, row.BoardingPassUploadedAt)
}

func boardingPassObject(bucket pgtype.Text, objectKey pgtype.Text, generation pgtype.Text, contentType pgtype.Text, byteSize pgtype.Int4, uploadedAt pgtype.Timestamptz) *flight.BoardingPassObject {
	if !bucket.Valid || !objectKey.Valid || !contentType.Valid || !byteSize.Valid || !uploadedAt.Valid {
		return nil
	}
	return &flight.BoardingPassObject{Bucket: bucket.String, ObjectKey: objectKey.String, Generation: textPtrFromSQL(generation), ContentType: contentType.String, ByteSize: int(byteSize.Int32), UploadedAt: uploadedAt.Time.UTC()}
}

func createStorageObjectDeletionJob(ctx context.Context, queries *db.Queries, object flight.BoardingPassObject, reason string) error {
	_, err := queries.CreateStorageObjectDeletionJob(ctx, db.CreateStorageObjectDeletionJobParams{Bucket: object.Bucket, ObjectKey: object.ObjectKey, ObjectGeneration: textPtrToSQL(object.Generation), Reason: reason})
	if err == pgx.ErrNoRows {
		return nil
	}
	return err
}

func dateFromString(value string) pgtype.Date {
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		panic(err)
	}
	return pgtype.Date{Time: parsed, Valid: true}
}

func clockTimeFromString(value string) pgtype.Time {
	parsed, err := time.Parse("15:04", value)
	if err != nil {
		panic(err)
	}
	return pgtype.Time{Microseconds: int64(parsed.Hour()*60*60+parsed.Minute()*60) * 1_000_000, Valid: true}
}

func clockTimeString(value pgtype.Time) string {
	if !value.Valid {
		return ""
	}
	seconds := value.Microseconds / 1_000_000
	hour := seconds / 3600
	minute := (seconds % 3600) / 60
	return time.Date(0, 1, 1, int(hour), int(minute), 0, 0, time.UTC).Format("15:04")
}

var _ flight.Repository = (*Store)(nil)
