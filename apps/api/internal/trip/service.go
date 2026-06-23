package trip

import (
	"context"
	"strings"
	"time"
)

const dateLayout = "2006-01-02"

type Service struct {
	repo  Repository
	today func() time.Time
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo, today: time.Now}
}

func (s *Service) Create(ctx context.Context, userID string, input CreateInput) (CreateResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateResult{}, ErrUnauthorized
	}

	name := strings.TrimSpace(input.Name)
	if len([]rune(name)) < 1 || len([]rune(name)) > 80 {
		return CreateResult{}, ErrValidation
	}

	startDate, err := parseDate(input.StartDate)
	if err != nil {
		return CreateResult{}, ErrValidation
	}
	endDate, err := parseDate(input.EndDate)
	if err != nil {
		return CreateResult{}, ErrValidation
	}
	if startDate.After(endDate) {
		return CreateResult{}, ErrValidation
	}
	if startDate.Before(dateOnly(s.today())) || endDate.Before(dateOnly(s.today())) {
		return CreateResult{}, ErrValidation
	}

	if !isSupportedCurrency(input.DefaultCurrency) {
		return CreateResult{}, ErrValidation
	}

	creator, ok, err := s.repo.GetCreator(ctx, userID)
	if err != nil {
		return CreateResult{}, err
	}
	if !ok {
		return CreateResult{}, ErrUnauthorized
	}

	return s.repo.CreateTripWithOwner(ctx, CreateRecord{
		Name:             name,
		StartDate:        startDate,
		EndDate:          endDate,
		DefaultCurrency:  input.DefaultCurrency,
		CreatedBy:        creator.ID,
		OwnerDisplayName: creator.DisplayName,
	})
}

func (s *Service) List(ctx context.Context, userID string) ([]ListItem, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
	}

	return s.repo.ListTripsByParticipantUser(ctx, userID)
}

func (s *Service) Update(ctx context.Context, userID string, tripID string, input UpdateInput) (UpdateResult, error) {
	if strings.TrimSpace(userID) == "" {
		return UpdateResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) || isEmptyUpdate(input) {
		return UpdateResult{}, ErrValidation
	}

	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return UpdateResult{}, err
	}
	if !ok {
		return UpdateResult{}, ErrNotFound
	}

	isOwner, err := s.repo.IsTripOwner(ctx, tripID, userID)
	if err != nil {
		return UpdateResult{}, err
	}
	if !isOwner {
		return UpdateResult{}, ErrForbidden
	}

	merged, err := mergeUpdateInput(foundTrip, input)
	if err != nil {
		return UpdateResult{}, err
	}

	updatedTrip, err := s.repo.UpdateTripBasicInfo(ctx, merged)
	if err != nil {
		return UpdateResult{}, err
	}

	return UpdateResult{Trip: updatedTrip}, nil
}

func (s *Service) Delete(ctx context.Context, userID string, tripID string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return ErrValidation
	}

	_, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrNotFound
	}

	isOwner, err := s.repo.IsTripOwner(ctx, tripID, userID)
	if err != nil {
		return err
	}
	if !isOwner {
		_, ok, err := s.repo.GetTripByID(ctx, tripID)
		if err != nil {
			return err
		}
		if !ok {
			return ErrNotFound
		}
		return ErrForbidden
	}

	deleted, err := s.repo.DeleteTripByID(ctx, tripID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}

	return nil
}

func (s *Service) GetDetail(ctx context.Context, userID string, tripID string) (GetDetailResult, error) {
	if strings.TrimSpace(userID) == "" {
		return GetDetailResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return GetDetailResult{}, ErrValidation
	}

	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return GetDetailResult{}, err
	}
	if !ok {
		return GetDetailResult{}, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return GetDetailResult{}, err
	}
	if !isParticipant {
		return GetDetailResult{}, ErrForbidden
	}

	totalCount, err := s.repo.CountTripParticipants(ctx, tripID)
	if err != nil {
		return GetDetailResult{}, err
	}

	previewNames, err := s.repo.ListTripParticipantPreviewNames(ctx, tripID)
	if err != nil {
		return GetDetailResult{}, err
	}
	for index, name := range previewNames {
		previewNames[index] = participantDisplayName(name)
	}

	days, err := tripDaysForRange(foundTrip.StartDate, foundTrip.EndDate)
	if err != nil {
		return GetDetailResult{}, err
	}

	overflowCount := totalCount - len(previewNames)
	if overflowCount < 0 {
		overflowCount = 0
	}

	return GetDetailResult{
		Trip: foundTrip,
		ParticipantSummary: ParticipantSummary{
			TotalCount:    totalCount,
			PreviewNames:  previewNames,
			OverflowCount: overflowCount,
		},
		Days: days,
	}, nil
}

func (s *Service) GetDayItinerary(ctx context.Context, userID string, tripID string, date string) (GetDayItineraryResult, error) {
	if strings.TrimSpace(userID) == "" {
		return GetDayItineraryResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	date = strings.TrimSpace(date)
	if !isUUID(tripID) {
		return GetDayItineraryResult{}, ErrValidation
	}

	selectedDate, err := parseDate(date)
	if err != nil {
		return GetDayItineraryResult{}, ErrValidation
	}

	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return GetDayItineraryResult{}, err
	}
	if !ok {
		return GetDayItineraryResult{}, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return GetDayItineraryResult{}, err
	}
	if !isParticipant {
		return GetDayItineraryResult{}, ErrForbidden
	}

	dayOrder, err := dayOrderInRange(foundTrip.StartDate, foundTrip.EndDate, selectedDate)
	if err != nil {
		return GetDayItineraryResult{}, ErrValidation
	}
	if dayOrder == 0 {
		return GetDayItineraryResult{}, ErrNotFound
	}

	items, err := s.repo.ListItineraryItemsByTripAndDate(ctx, tripID, selectedDate.Format(dateLayout))
	if err != nil {
		return GetDayItineraryResult{}, err
	}

	return GetDayItineraryResult{
		Day: TripDay{
			Date:     selectedDate.Format(dateLayout),
			DayOrder: dayOrder,
		},
		Items: items,
	}, nil
}

func (s *Service) CreateManualDayItineraryItem(ctx context.Context, userID string, tripID string, date string, input CreateManualDayItineraryItemInput) (CreateManualDayItineraryItemResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateManualDayItineraryItemResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	date = strings.TrimSpace(date)
	if !isUUID(tripID) {
		return CreateManualDayItineraryItemResult{}, ErrValidation
	}

	selectedDate, err := parseDate(date)
	if err != nil {
		return CreateManualDayItineraryItemResult{}, ErrValidation
	}

	name := strings.TrimSpace(input.Name)
	if len([]rune(name)) < 1 || len([]rune(name)) > 120 {
		return CreateManualDayItineraryItemResult{}, ErrValidation
	}

	address := strings.TrimSpace(input.Address)
	if len([]rune(address)) < 1 || len([]rune(address)) > 240 {
		return CreateManualDayItineraryItemResult{}, ErrValidation
	}

	placeType := strings.TrimSpace(input.PlaceType)
	if !isSupportedPlaceType(placeType) {
		return CreateManualDayItineraryItemResult{}, ErrValidation
	}

	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return CreateManualDayItineraryItemResult{}, err
	}
	if !ok {
		return CreateManualDayItineraryItemResult{}, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return CreateManualDayItineraryItemResult{}, err
	}
	if !isParticipant {
		return CreateManualDayItineraryItemResult{}, ErrForbidden
	}

	dayOrder, err := dayOrderInRange(foundTrip.StartDate, foundTrip.EndDate, selectedDate)
	if err != nil {
		return CreateManualDayItineraryItemResult{}, ErrValidation
	}
	if dayOrder == 0 {
		return CreateManualDayItineraryItemResult{}, ErrNotFound
	}

	item, err := s.repo.CreateManualDayItineraryItem(ctx, CreateManualDayItineraryItemRecord{
		TripID:        tripID,
		ScheduledDate: selectedDate.Format(dateLayout),
		Name:          name,
		Address:       address,
		PlaceType:     placeType,
	})
	if err != nil {
		return CreateManualDayItineraryItemResult{}, err
	}

	return CreateManualDayItineraryItemResult{
		Day: TripDay{
			Date:     selectedDate.Format(dateLayout),
			DayOrder: dayOrder,
		},
		Item: item,
	}, nil
}

func (s *Service) UpdateDayItineraryItem(ctx context.Context, userID string, tripID string, date string, itemID string, input UpdateDayItineraryItemInput) (UpdateDayItineraryItemResult, error) {
	if strings.TrimSpace(userID) == "" {
		return UpdateDayItineraryItemResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	date = strings.TrimSpace(date)
	itemID = strings.TrimSpace(itemID)
	if !isUUID(tripID) || !isUUID(itemID) || isEmptyDayItineraryItemUpdate(input) {
		return UpdateDayItineraryItemResult{}, ErrValidation
	}

	selectedDate, err := parseDate(date)
	if err != nil {
		return UpdateDayItineraryItemResult{}, ErrValidation
	}

	if err := validateUpdateDayItineraryItemInput(input); err != nil {
		return UpdateDayItineraryItemResult{}, err
	}

	if err := s.validateTripDayParticipant(ctx, userID, tripID, selectedDate); err != nil {
		return UpdateDayItineraryItemResult{}, err
	}

	foundItem, ok, err := s.repo.GetItineraryItemByTripDateAndID(ctx, tripID, selectedDate.Format(dateLayout), itemID)
	if err != nil {
		return UpdateDayItineraryItemResult{}, err
	}
	if !ok {
		return UpdateDayItineraryItemResult{}, ErrNotFound
	}

	merged, err := mergeUpdateDayItineraryItemInput(tripID, selectedDate.Format(dateLayout), itemID, foundItem, input)
	if err != nil {
		return UpdateDayItineraryItemResult{}, err
	}

	updatedItem, err := s.repo.UpdateDayItineraryItemPlace(ctx, merged)
	if err != nil {
		return UpdateDayItineraryItemResult{}, err
	}

	return UpdateDayItineraryItemResult{Item: updatedItem}, nil
}

func (s *Service) DeleteDayItineraryItem(ctx context.Context, userID string, tripID string, date string, itemID string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	date = strings.TrimSpace(date)
	itemID = strings.TrimSpace(itemID)
	if !isUUID(tripID) || !isUUID(itemID) {
		return ErrValidation
	}

	selectedDate, err := parseDate(date)
	if err != nil {
		return ErrValidation
	}

	if err := s.validateTripDayParticipant(ctx, userID, tripID, selectedDate); err != nil {
		return err
	}

	deleted, err := s.repo.DeleteDayItineraryItem(ctx, tripID, selectedDate.Format(dateLayout), itemID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}

	return nil
}

func (s *Service) ReorderDayItineraryItems(ctx context.Context, userID string, tripID string, date string, moves []ReorderDayItineraryMoveInput) (ReorderDayItineraryItemsResult, error) {
	if strings.TrimSpace(userID) == "" {
		return ReorderDayItineraryItemsResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	date = strings.TrimSpace(date)
	if !isUUID(tripID) || len(moves) == 0 {
		return ReorderDayItineraryItemsResult{}, ErrValidation
	}

	selectedDate, err := parseDate(date)
	if err != nil {
		return ReorderDayItineraryItemsResult{}, ErrValidation
	}

	if err := s.validateTripDayParticipant(ctx, userID, tripID, selectedDate); err != nil {
		return ReorderDayItineraryItemsResult{}, err
	}

	recordMoves := make([]ReorderDayItineraryMoveRecord, 0, len(moves))
	for _, move := range moves {
		recordMove, err := s.validateReorderDayItineraryMove(ctx, tripID, selectedDate.Format(dateLayout), move)
		if err != nil {
			return ReorderDayItineraryItemsResult{}, err
		}
		recordMoves = append(recordMoves, recordMove)
	}

	items, err := s.repo.ReorderDayItineraryItems(ctx, ReorderDayItineraryItemsRecord{
		TripID:        tripID,
		ScheduledDate: selectedDate.Format(dateLayout),
		Moves:         recordMoves,
	})
	if err != nil {
		return ReorderDayItineraryItemsResult{}, err
	}

	dayOrder, err := s.dayOrder(ctx, userID, tripID, selectedDate)
	if err != nil {
		return ReorderDayItineraryItemsResult{}, err
	}

	return ReorderDayItineraryItemsResult{
		Day: TripDay{
			Date:     selectedDate.Format(dateLayout),
			DayOrder: dayOrder,
		},
		Items: items,
	}, nil
}

func (s *Service) validateTripDayParticipant(ctx context.Context, userID string, tripID string, selectedDate time.Time) error {
	_, err := s.dayOrder(ctx, userID, tripID, selectedDate)
	return err
}

func (s *Service) dayOrder(ctx context.Context, userID string, tripID string, selectedDate time.Time) (int, error) {
	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return 0, err
	}
	if !isParticipant {
		return 0, ErrForbidden
	}

	dayOrder, err := dayOrderInRange(foundTrip.StartDate, foundTrip.EndDate, selectedDate)
	if err != nil {
		return 0, ErrValidation
	}
	if dayOrder == 0 {
		return 0, ErrNotFound
	}
	return dayOrder, nil
}

func (s *Service) validateReorderDayItineraryMove(ctx context.Context, tripID string, date string, move ReorderDayItineraryMoveInput) (ReorderDayItineraryMoveRecord, error) {
	itemID := strings.TrimSpace(move.ItemID)
	beforeItemID := trimOptionalString(move.BeforeItemID)
	afterItemID := trimOptionalString(move.AfterItemID)
	if !isUUID(itemID) || move.ClientVersion < 1 || (beforeItemID == nil && afterItemID == nil) {
		return ReorderDayItineraryMoveRecord{}, ErrValidation
	}
	if !isDistinctMoveIDs(itemID, beforeItemID, afterItemID) {
		return ReorderDayItineraryMoveRecord{}, ErrValidation
	}
	if !optionalUUID(beforeItemID) || !optionalUUID(afterItemID) {
		return ReorderDayItineraryMoveRecord{}, ErrValidation
	}

	for _, referencedID := range referencedMoveItemIDs(itemID, beforeItemID, afterItemID) {
		_, ok, err := s.repo.GetItineraryItemByTripDateAndID(ctx, tripID, date, referencedID)
		if err != nil {
			return ReorderDayItineraryMoveRecord{}, err
		}
		if !ok {
			return ReorderDayItineraryMoveRecord{}, ErrValidation
		}
	}

	return ReorderDayItineraryMoveRecord{
		ItemID:        itemID,
		BeforeItemID:  beforeItemID,
		AfterItemID:   afterItemID,
		ClientVersion: move.ClientVersion,
	}, nil
}

func mergeUpdateInput(foundTrip Trip, input UpdateInput) (UpdateRecord, error) {
	name := foundTrip.Name
	if input.Name != nil {
		name = strings.TrimSpace(*input.Name)
	}
	if len([]rune(name)) < 1 || len([]rune(name)) > 80 {
		return UpdateRecord{}, ErrValidation
	}

	startDateText := foundTrip.StartDate
	if input.StartDate != nil {
		startDateText = *input.StartDate
	}
	startDate, err := parseDate(startDateText)
	if err != nil {
		return UpdateRecord{}, ErrValidation
	}

	endDateText := foundTrip.EndDate
	if input.EndDate != nil {
		endDateText = *input.EndDate
	}
	endDate, err := parseDate(endDateText)
	if err != nil {
		return UpdateRecord{}, ErrValidation
	}
	if startDate.After(endDate) {
		return UpdateRecord{}, ErrValidation
	}

	defaultCurrency := foundTrip.DefaultCurrency
	if input.DefaultCurrency != nil {
		defaultCurrency = *input.DefaultCurrency
	}
	if !isSupportedCurrency(defaultCurrency) {
		return UpdateRecord{}, ErrValidation
	}

	return UpdateRecord{
		ID:              foundTrip.ID,
		Name:            name,
		StartDate:       startDate,
		EndDate:         endDate,
		DefaultCurrency: defaultCurrency,
	}, nil
}

func isEmptyUpdate(input UpdateInput) bool {
	return input.Name == nil && input.StartDate == nil && input.EndDate == nil && input.DefaultCurrency == nil
}

func isEmptyDayItineraryItemUpdate(input UpdateDayItineraryItemInput) bool {
	return input.Name == nil && input.Address == nil && input.PlaceType == nil
}

func validateUpdateDayItineraryItemInput(input UpdateDayItineraryItemInput) error {
	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if len([]rune(name)) < 1 || len([]rune(name)) > 120 {
			return ErrValidation
		}
	}
	if input.Address != nil {
		address := strings.TrimSpace(*input.Address)
		if len([]rune(address)) < 1 || len([]rune(address)) > 300 {
			return ErrValidation
		}
	}
	if input.PlaceType != nil {
		placeType := strings.TrimSpace(*input.PlaceType)
		if !isSupportedPlaceType(placeType) {
			return ErrValidation
		}
	}
	return nil
}

func mergeUpdateDayItineraryItemInput(tripID string, date string, itemID string, foundItem DayItineraryItem, input UpdateDayItineraryItemInput) (UpdateDayItineraryItemRecord, error) {
	name := foundItem.Place.Name
	if input.Name != nil {
		name = strings.TrimSpace(*input.Name)
	}
	if len([]rune(name)) < 1 || len([]rune(name)) > 120 {
		return UpdateDayItineraryItemRecord{}, ErrValidation
	}

	address := foundItem.Place.Address
	if input.Address != nil {
		address = strings.TrimSpace(*input.Address)
	}
	if len([]rune(address)) < 1 || len([]rune(address)) > 300 {
		return UpdateDayItineraryItemRecord{}, ErrValidation
	}

	placeType := foundItem.Place.PlaceType
	if input.PlaceType != nil {
		placeType = strings.TrimSpace(*input.PlaceType)
	}
	if !isSupportedPlaceType(placeType) {
		return UpdateDayItineraryItemRecord{}, ErrValidation
	}

	return UpdateDayItineraryItemRecord{
		TripID:        tripID,
		ScheduledDate: date,
		ItemID:        itemID,
		Name:          name,
		Address:       address,
		PlaceType:     placeType,
	}, nil
}

func parseDate(value string) (time.Time, error) {
	return time.Parse(dateLayout, value)
}

func tripDaysForRange(startDateText string, endDateText string) ([]TripDay, error) {
	startDate, err := parseDate(startDateText)
	if err != nil {
		return nil, err
	}
	endDate, err := parseDate(endDateText)
	if err != nil {
		return nil, err
	}

	days := []TripDay{}
	for current, order := startDate, 1; !current.After(endDate); current, order = current.AddDate(0, 0, 1), order+1 {
		days = append(days, TripDay{
			Date:     current.Format(dateLayout),
			DayOrder: order,
		})
	}
	return days, nil
}

func dayOrderInRange(startDateText string, endDateText string, selectedDate time.Time) (int, error) {
	startDate, err := parseDate(startDateText)
	if err != nil {
		return 0, err
	}
	endDate, err := parseDate(endDateText)
	if err != nil {
		return 0, err
	}
	if selectedDate.Before(startDate) || selectedDate.After(endDate) {
		return 0, nil
	}
	return int(selectedDate.Sub(startDate).Hours()/24) + 1, nil
}

func dateOnly(value time.Time) time.Time {
	parsed, err := parseDate(value.Format(dateLayout))
	if err != nil {
		return time.Time{}
	}
	return parsed
}

func isSupportedCurrency(value string) bool {
	switch value {
	case "KRW", "JPY", "USD", "EUR":
		return true
	default:
		return false
	}
}

func isSupportedPlaceType(value string) bool {
	switch value {
	case "sights", "food", "lodging", "cafe", "shopping", "etc":
		return true
	default:
		return false
	}
}

func trimOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

func optionalUUID(value *string) bool {
	return value == nil || isUUID(*value)
}

func isDistinctMoveIDs(itemID string, beforeItemID *string, afterItemID *string) bool {
	ids := map[string]struct{}{itemID: {}}
	if beforeItemID != nil {
		if _, exists := ids[*beforeItemID]; exists {
			return false
		}
		ids[*beforeItemID] = struct{}{}
	}
	if afterItemID != nil {
		if _, exists := ids[*afterItemID]; exists {
			return false
		}
	}
	return true
}

func referencedMoveItemIDs(itemID string, beforeItemID *string, afterItemID *string) []string {
	referenced := []string{itemID}
	if beforeItemID != nil {
		referenced = append(referenced, *beforeItemID)
	}
	if afterItemID != nil {
		referenced = append(referenced, *afterItemID)
	}
	return referenced
}

func isUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, char := range value {
		switch index {
		case 8, 13, 18, 23:
			if char != '-' {
				return false
			}
		default:
			if !isHex(char) {
				return false
			}
		}
	}
	return true
}

func isHex(char rune) bool {
	return (char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')
}

func participantDisplayName(value string) string {
	name := strings.TrimSpace(value)
	if name == "" {
		return "여행자"
	}
	return name
}
