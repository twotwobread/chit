package trip

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"sort"
	"strings"
	"time"
)

const (
	dateLayout             = "2006-01-02"
	defaultInviteBaseURL   = "http://localhost:8080"
	inviteExpiryDuration   = 7 * 24 * time.Hour
	inviteTokenRandomBytes = 32
)

type Service struct {
	repo                Repository
	today               func() time.Time
	now                 func() time.Time
	generateInviteToken func() (string, error)
	inviteBaseURL       string
}

type ServiceOption func(*Service)

func WithInviteBaseURL(value string) ServiceOption {
	return func(s *Service) {
		if strings.TrimSpace(value) != "" {
			s.inviteBaseURL = strings.TrimRight(strings.TrimSpace(value), "/")
		}
	}
}

func NewService(repo Repository, options ...ServiceOption) *Service {
	service := &Service{
		repo:                repo,
		today:               time.Now,
		now:                 time.Now,
		generateInviteToken: generateInviteToken,
		inviteBaseURL:       defaultInviteBaseURL,
	}
	for _, option := range options {
		option(service)
	}
	return service
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

func (s *Service) RemoveParticipant(ctx context.Context, userID string, tripID string, participantID string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	participantID = strings.TrimSpace(participantID)
	if !isUUID(tripID) || !isUUID(participantID) {
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
		return ErrForbidden
	}

	deleted, err := s.repo.DeleteTripMemberParticipant(ctx, tripID, participantID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}

	return nil
}

func (s *Service) CreateInvite(ctx context.Context, userID string, tripID string) (CreateTripInviteResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateTripInviteResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return CreateTripInviteResult{}, ErrValidation
	}

	_, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return CreateTripInviteResult{}, err
	}
	if !ok {
		return CreateTripInviteResult{}, ErrNotFound
	}

	isOwner, err := s.repo.IsTripOwner(ctx, tripID, userID)
	if err != nil {
		return CreateTripInviteResult{}, err
	}
	if !isOwner {
		return CreateTripInviteResult{}, ErrForbidden
	}

	now := s.now().UTC()
	for attempt := 0; attempt < 3; attempt++ {
		token, err := s.generateInviteToken()
		if err != nil {
			return CreateTripInviteResult{}, err
		}

		result, err := s.repo.CreateOrReturnTripInvite(ctx, CreateTripInviteRecord{
			TripID:    tripID,
			CreatedBy: userID,
			Token:     token,
			Now:       now,
			ExpiresAt: now.Add(inviteExpiryDuration),
		})
		if err == ErrConflict {
			continue
		}
		if err != nil {
			return CreateTripInviteResult{}, err
		}
		result.Invite.InviteURL = s.inviteURL(result.Invite.Token)
		return result, nil
	}

	return CreateTripInviteResult{}, ErrConflict
}

func (s *Service) AcceptInvite(ctx context.Context, userID string, token string) (AcceptTripInviteResult, error) {
	if strings.TrimSpace(userID) == "" {
		return AcceptTripInviteResult{}, ErrUnauthorized
	}

	token = strings.TrimSpace(token)
	if !isInviteToken(token) {
		return AcceptTripInviteResult{}, ErrValidation
	}

	return s.repo.AcceptTripInvite(ctx, AcceptTripInviteRecord{
		Token:  token,
		UserID: userID,
		Now:    s.now().UTC(),
	})
}

func (s *Service) inviteURL(token string) string {
	return strings.TrimRight(s.inviteBaseURL, "/") + "/invite/" + token
}

func generateInviteToken() (string, error) {
	buffer := make([]byte, inviteTokenRandomBytes)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
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

	days, err := s.repo.ListActiveTripDaysByTrip(ctx, tripID)
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

func (s *Service) ListParticipants(ctx context.Context, userID string, tripID string) ([]ParticipantListItem, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return nil, ErrValidation
	}

	_, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return nil, err
	}
	if !isParticipant {
		return nil, ErrForbidden
	}

	participants, err := s.repo.ListTripParticipants(ctx, tripID)
	if err != nil {
		return nil, err
	}
	for index, participant := range participants {
		participants[index].DisplayName = participantDisplayName(participant.DisplayName)
	}
	return participants, nil
}

func (s *Service) GetDayScheduleItems(ctx context.Context, userID string, tripID string, tripDayID string) (GetDayScheduleItemsResult, error) {
	day, err := s.activeTripDay(ctx, userID, tripID, tripDayID)
	if err != nil {
		return GetDayScheduleItemsResult{}, err
	}

	items, err := s.repo.ListScheduleItemsByTripDay(ctx, strings.TrimSpace(tripID), strings.TrimSpace(tripDayID))
	if err != nil {
		return GetDayScheduleItemsResult{}, err
	}

	return GetDayScheduleItemsResult{Day: day, Items: items}, nil
}

func (s *Service) ListDayExpenses(ctx context.Context, userID string, tripID string, tripDayID string) (ListDayExpensesResult, error) {
	if _, err := s.activeTripDay(ctx, userID, tripID, tripDayID); err != nil {
		return ListDayExpensesResult{}, err
	}

	expenses, err := s.repo.ListDayExpensesByTripDay(ctx, strings.TrimSpace(tripID), strings.TrimSpace(tripDayID))
	if err != nil {
		return ListDayExpensesResult{}, err
	}

	return ListDayExpensesResult{Expenses: expenses}, nil
}

func (s *Service) CreateQuickExpense(ctx context.Context, userID string, tripID string, tripDayID string, input CreateQuickExpenseInput) (CreateQuickExpenseResult, error) {
	scheduleItemID := strings.TrimSpace(input.ScheduleItemID)
	payerParticipantID := strings.TrimSpace(input.PayerParticipantID)
	participantIDs, err := normalizeQuickExpenseParticipantIDs(input.ParticipantIDs)
	if err != nil {
		return CreateQuickExpenseResult{}, err
	}
	if !isUUID(scheduleItemID) || !isUUID(payerParticipantID) || input.AmountMinor < 1 {
		return CreateQuickExpenseResult{}, ErrValidation
	}
	if _, err := s.activeTripDay(ctx, userID, tripID, tripDayID); err != nil {
		return CreateQuickExpenseResult{}, err
	}

	return s.repo.CreateQuickExpense(ctx, CreateQuickExpenseRecord{
		TripID:             strings.TrimSpace(tripID),
		TripDayID:          strings.TrimSpace(tripDayID),
		ScheduleItemID:     scheduleItemID,
		AmountMinor:        input.AmountMinor,
		PayerParticipantID: payerParticipantID,
		ParticipantIDs:     participantIDs,
		CreatedBy:          userID,
	})
}

func normalizeQuickExpenseParticipantIDs(participantIDs []string) ([]string, error) {
	if len(participantIDs) == 0 {
		return nil, ErrValidation
	}

	seen := make(map[string]struct{}, len(participantIDs))
	normalized := make([]string, 0, len(participantIDs))
	for _, rawID := range participantIDs {
		participantID := strings.ToLower(strings.TrimSpace(rawID))
		if !isUUID(participantID) {
			return nil, ErrValidation
		}
		if _, ok := seen[participantID]; ok {
			return nil, ErrValidation
		}
		seen[participantID] = struct{}{}
		normalized = append(normalized, participantID)
	}
	return normalized, nil
}

func (s *Service) SetDayLodgingPlace(ctx context.Context, userID string, tripID string, tripDayID string, input SetDayLodgingPlaceInput) (SetDayLodgingPlaceResult, error) {
	tripPlaceID := strings.TrimSpace(input.TripPlaceID)
	if !isUUID(tripPlaceID) {
		return SetDayLodgingPlaceResult{}, ErrValidation
	}
	day, err := s.activeTripDay(ctx, userID, tripID, tripDayID)
	if err != nil {
		return SetDayLodgingPlaceResult{}, err
	}
	if _, ok, err := s.repo.GetTripPlaceSummaryByTripAndPlace(ctx, strings.TrimSpace(tripID), tripPlaceID); err != nil {
		return SetDayLodgingPlaceResult{}, err
	} else if !ok {
		return SetDayLodgingPlaceResult{}, ErrNotFound
	}

	lodgingPlace, err := s.repo.SetDayLodgingPlace(ctx, SetDayLodgingPlaceRecord{TripID: strings.TrimSpace(tripID), TripDayID: strings.TrimSpace(tripDayID), TripPlaceID: tripPlaceID})
	if err != nil {
		return SetDayLodgingPlaceResult{}, err
	}
	day.LodgingPlace = &lodgingPlace
	return SetDayLodgingPlaceResult{Day: day, LodgingPlace: lodgingPlace}, nil
}

func (s *Service) ClearDayLodgingPlace(ctx context.Context, userID string, tripID string, tripDayID string) error {
	if _, err := s.activeTripDay(ctx, userID, tripID, tripDayID); err != nil {
		return err
	}
	return s.repo.DeleteDayLodgingPlace(ctx, strings.TrimSpace(tripID), strings.TrimSpace(tripDayID))
}

func (s *Service) CreateManualScheduleItem(ctx context.Context, userID string, tripID string, tripDayID string, input CreateManualScheduleItemInput) (CreateManualScheduleItemResult, error) {
	day, err := s.activeTripDay(ctx, userID, tripID, tripDayID)
	if err != nil {
		return CreateManualScheduleItemResult{}, err
	}

	name := strings.TrimSpace(input.Name)
	if len([]rune(name)) < 1 || len([]rune(name)) > 120 {
		return CreateManualScheduleItemResult{}, ErrValidation
	}
	address := strings.TrimSpace(input.Address)
	if len([]rune(address)) < 1 || len([]rune(address)) > 240 {
		return CreateManualScheduleItemResult{}, ErrValidation
	}
	placeType := strings.TrimSpace(input.PlaceType)
	if !isSupportedPlaceType(placeType) {
		return CreateManualScheduleItemResult{}, ErrValidation
	}

	item, err := s.repo.CreateManualScheduleItem(ctx, CreateManualScheduleItemRecord{TripID: strings.TrimSpace(tripID), TripDayID: strings.TrimSpace(tripDayID), Name: name, Address: address, PlaceType: placeType})
	if err != nil {
		return CreateManualScheduleItemResult{}, err
	}
	return CreateManualScheduleItemResult{Day: day, Item: item}, nil
}

func (s *Service) UpdateScheduleItem(ctx context.Context, userID string, tripID string, tripDayID string, itemID string, input UpdateScheduleItemInput) (UpdateScheduleItemResult, error) {
	if _, err := s.activeTripDay(ctx, userID, tripID, tripDayID); err != nil {
		return UpdateScheduleItemResult{}, err
	}
	itemID = strings.TrimSpace(itemID)
	if !isUUID(itemID) || isEmptyScheduleItemUpdate(input) {
		return UpdateScheduleItemResult{}, ErrValidation
	}
	if err := validateUpdateScheduleItemInput(input); err != nil {
		return UpdateScheduleItemResult{}, err
	}

	foundItem, ok, err := s.repo.GetScheduleItemByTripDayAndID(ctx, strings.TrimSpace(tripID), strings.TrimSpace(tripDayID), itemID)
	if err != nil {
		return UpdateScheduleItemResult{}, err
	}
	if !ok {
		return UpdateScheduleItemResult{}, ErrNotFound
	}

	merged, err := mergeUpdateScheduleItemInput(strings.TrimSpace(tripID), strings.TrimSpace(tripDayID), itemID, foundItem, input)
	if err != nil {
		return UpdateScheduleItemResult{}, err
	}
	updatedItem, err := s.repo.UpdateScheduleItemPlace(ctx, merged)
	if err != nil {
		return UpdateScheduleItemResult{}, err
	}
	return UpdateScheduleItemResult{Item: updatedItem}, nil
}

func (s *Service) MarkScheduleItemArrived(ctx context.Context, userID string, tripID string, tripDayID string, itemID string) (MarkScheduleItemArrivedResult, error) {
	itemID = strings.TrimSpace(itemID)
	if !isUUID(itemID) {
		return MarkScheduleItemArrivedResult{}, ErrValidation
	}
	day, err := s.activeTripDay(ctx, userID, tripID, tripDayID)
	if err != nil {
		return MarkScheduleItemArrivedResult{}, err
	}
	mutation, err := s.repo.MarkScheduleItemArrived(ctx, MarkScheduleItemArrivedRecord{TripID: strings.TrimSpace(tripID), TripDayID: strings.TrimSpace(tripDayID), ItemID: itemID})
	if err != nil {
		return MarkScheduleItemArrivedResult{}, err
	}
	return MarkScheduleItemArrivedResult{Day: day, Item: mutation.Item, Items: mutation.Items}, nil
}

func (s *Service) MarkScheduleItemSkipped(ctx context.Context, userID string, tripID string, tripDayID string, itemID string) (MarkScheduleItemSkippedResult, error) {
	itemID = strings.TrimSpace(itemID)
	if !isUUID(itemID) {
		return MarkScheduleItemSkippedResult{}, ErrValidation
	}
	day, err := s.activeTripDay(ctx, userID, tripID, tripDayID)
	if err != nil {
		return MarkScheduleItemSkippedResult{}, err
	}
	mutation, err := s.repo.MarkScheduleItemSkipped(ctx, MarkScheduleItemSkippedRecord{TripID: strings.TrimSpace(tripID), TripDayID: strings.TrimSpace(tripDayID), ItemID: itemID})
	if err != nil {
		return MarkScheduleItemSkippedResult{}, err
	}
	return MarkScheduleItemSkippedResult{Day: day, Item: mutation.Item, Items: mutation.Items}, nil
}

func (s *Service) RestoreScheduleItem(ctx context.Context, userID string, tripID string, tripDayID string, itemID string) (RestoreScheduleItemResult, error) {
	itemID = strings.TrimSpace(itemID)
	if !isUUID(itemID) {
		return RestoreScheduleItemResult{}, ErrValidation
	}
	day, err := s.activeTripDay(ctx, userID, tripID, tripDayID)
	if err != nil {
		return RestoreScheduleItemResult{}, err
	}
	mutation, err := s.repo.RestoreScheduleItem(ctx, RestoreScheduleItemRecord{TripID: strings.TrimSpace(tripID), TripDayID: strings.TrimSpace(tripDayID), ItemID: itemID})
	if err != nil {
		return RestoreScheduleItemResult{}, err
	}
	return RestoreScheduleItemResult{Day: day, Item: mutation.Item, Items: mutation.Items}, nil
}

func (s *Service) DeleteScheduleItem(ctx context.Context, userID string, tripID string, tripDayID string, itemID string) error {
	itemID = strings.TrimSpace(itemID)
	if !isUUID(itemID) {
		return ErrValidation
	}
	if _, err := s.activeTripDay(ctx, userID, tripID, tripDayID); err != nil {
		return err
	}
	deleted, err := s.repo.DeleteScheduleItem(ctx, strings.TrimSpace(tripID), strings.TrimSpace(tripDayID), itemID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

func (s *Service) ReorderScheduleItems(ctx context.Context, userID string, tripID string, tripDayID string, moves []ReorderDayScheduleMoveInput) (ReorderScheduleItemsResult, error) {
	day, err := s.activeTripDay(ctx, userID, tripID, tripDayID)
	if err != nil {
		return ReorderScheduleItemsResult{}, err
	}
	if len(moves) == 0 {
		return ReorderScheduleItemsResult{}, ErrValidation
	}
	recordMoves := make([]ReorderDayScheduleMoveRecord, 0, len(moves))
	for _, move := range moves {
		recordMove, err := s.validateReorderDayScheduleMove(ctx, strings.TrimSpace(tripID), strings.TrimSpace(tripDayID), move)
		if err != nil {
			return ReorderScheduleItemsResult{}, err
		}
		recordMoves = append(recordMoves, recordMove)
	}
	items, err := s.repo.ReorderScheduleItems(ctx, ReorderScheduleItemsRecord{TripID: strings.TrimSpace(tripID), TripDayID: strings.TrimSpace(tripDayID), Moves: recordMoves})
	if err != nil {
		return ReorderScheduleItemsResult{}, err
	}
	return ReorderScheduleItemsResult{Day: day, Items: items}, nil
}

func (s *Service) activeTripDay(ctx context.Context, userID string, tripID string, tripDayID string) (TripDay, error) {
	if strings.TrimSpace(userID) == "" {
		return TripDay{}, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	tripDayID = strings.TrimSpace(tripDayID)
	if !isUUID(tripID) {
		return TripDay{}, ErrValidation
	}
	if !isUUID(tripDayID) {
		if _, err := parseDate(tripDayID); err != nil {
			return TripDay{}, ErrValidation
		}
	}

	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return TripDay{}, err
	}
	if !ok {
		return TripDay{}, ErrNotFound
	}
	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return TripDay{}, err
	}
	if !isParticipant {
		return TripDay{}, ErrForbidden
	}
	if !isUUID(tripDayID) {
		selectedDate, err := parseDate(tripDayID)
		if err != nil {
			return TripDay{}, ErrValidation
		}
		dayOrder, err := dayOrderInRange(foundTrip.StartDate, foundTrip.EndDate, selectedDate)
		if err != nil {
			return TripDay{}, ErrValidation
		}
		if dayOrder == 0 {
			return TripDay{}, ErrNotFound
		}
		if day, ok, err := s.repo.GetActiveTripDayByTripAndID(ctx, tripID, tripDayID); err != nil {
			return TripDay{}, err
		} else if ok {
			if day.Date == "" {
				day.Date = selectedDate.Format(dateLayout)
			}
			if day.DayOrder == 0 {
				day.DayOrder = dayOrder
			}
			return day, nil
		}
		return TripDay{ID: tripDayID, Date: selectedDate.Format(dateLayout), DayOrder: dayOrder}, nil
	}
	day, ok, err := s.repo.GetActiveTripDayByTripAndID(ctx, tripID, tripDayID)
	if err != nil {
		return TripDay{}, err
	}
	if !ok {
		return TripDay{}, ErrNotFound
	}
	return day, nil
}

func (s *Service) validateReorderDayScheduleMove(ctx context.Context, tripID string, tripDayID string, move ReorderDayScheduleMoveInput) (ReorderDayScheduleMoveRecord, error) {
	itemID := strings.TrimSpace(move.ItemID)
	beforeItemID := trimOptionalString(move.BeforeItemID)
	afterItemID := trimOptionalString(move.AfterItemID)
	if !isUUID(itemID) || move.ClientVersion < 1 || (beforeItemID == nil && afterItemID == nil) {
		return ReorderDayScheduleMoveRecord{}, ErrValidation
	}
	if !isDistinctMoveIDs(itemID, beforeItemID, afterItemID) {
		return ReorderDayScheduleMoveRecord{}, ErrValidation
	}
	if !optionalUUID(beforeItemID) || !optionalUUID(afterItemID) {
		return ReorderDayScheduleMoveRecord{}, ErrValidation
	}

	for _, referencedID := range referencedMoveItemIDs(itemID, beforeItemID, afterItemID) {
		_, ok, err := s.repo.GetScheduleItemByTripDayAndID(ctx, tripID, tripDayID, referencedID)
		if err != nil {
			return ReorderDayScheduleMoveRecord{}, err
		}
		if !ok {
			return ReorderDayScheduleMoveRecord{}, ErrValidation
		}
	}

	return ReorderDayScheduleMoveRecord{
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
	return input.Name == nil && input.StartDate == nil && input.EndDate == nil && input.DefaultCurrency == nil && input.ConfirmOutOfRangeDayArchive == nil
}

func isEmptyScheduleItemUpdate(input UpdateScheduleItemInput) bool {
	return input.Name == nil && input.Address == nil && input.PlaceType == nil
}

func validateUpdateScheduleItemInput(input UpdateScheduleItemInput) error {
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

func mergeUpdateScheduleItemInput(tripID string, tripDayID string, itemID string, foundItem ScheduleItem, input UpdateScheduleItemInput) (UpdateScheduleItemRecord, error) {
	name := foundItem.Place.Name
	if input.Name != nil {
		name = strings.TrimSpace(*input.Name)
	}
	if len([]rune(name)) < 1 || len([]rune(name)) > 120 {
		return UpdateScheduleItemRecord{}, ErrValidation
	}

	address := foundItem.Place.Address
	if input.Address != nil {
		address = strings.TrimSpace(*input.Address)
	}
	if len([]rune(address)) < 1 || len([]rune(address)) > 300 {
		return UpdateScheduleItemRecord{}, ErrValidation
	}

	placeType := foundItem.Place.PlaceType
	if input.PlaceType != nil {
		placeType = strings.TrimSpace(*input.PlaceType)
	}
	if !isSupportedPlaceType(placeType) {
		return UpdateScheduleItemRecord{}, ErrValidation
	}

	return UpdateScheduleItemRecord{
		TripID:    tripID,
		TripDayID: tripDayID,
		ItemID:    itemID,
		Name:      name,
		Address:   address,
		PlaceType: placeType,
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

func applyDayLodgingPlaces(days []TripDay, lodgingPlaces []DayLodgingPlace) {
	byDate := map[string]TripPlaceSummary{}
	for _, lodgingPlace := range lodgingPlaces {
		byDate[lodgingPlace.Date] = lodgingPlace.Place
	}
	for index := range days {
		place, ok := byDate[days[index].Date]
		if ok {
			days[index].LodgingPlace = &place
		}
	}
}

func optionalTripPlaceSummary(place TripPlaceSummary, ok bool) *TripPlaceSummary {
	if !ok {
		return nil
	}
	return &place
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

func isInviteToken(value string) bool {
	if len(value) < 32 || len(value) > 128 {
		return false
	}
	for _, char := range value {
		if (char >= '0' && char <= '9') || (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char == '_' || char == '-' {
			continue
		}
		return false
	}
	return true
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

func NormalizeParticipantDisplayName(value string) string {
	name := strings.TrimSpace(value)
	if name == "" {
		return "여행자"
	}
	return name
}

func SelectExpenseSplitParticipants(participants []ExpenseSplitParticipant, participantIDs []string) ([]ExpenseSplitParticipant, error) {
	if len(participantIDs) == 0 {
		return nil, ErrValidation
	}

	selectedParticipantIDs := make(map[string]struct{}, len(participantIDs))
	for _, participantID := range participantIDs {
		if participantID == "" {
			return nil, ErrValidation
		}
		if _, ok := selectedParticipantIDs[participantID]; ok {
			return nil, ErrValidation
		}
		selectedParticipantIDs[participantID] = struct{}{}
	}

	selectedParticipants := make([]ExpenseSplitParticipant, 0, len(selectedParticipantIDs))
	for _, participant := range participants {
		if _, ok := selectedParticipantIDs[participant.ParticipantID]; !ok {
			continue
		}
		selectedParticipants = append(selectedParticipants, participant)
		delete(selectedParticipantIDs, participant.ParticipantID)
	}
	if len(selectedParticipantIDs) > 0 || len(selectedParticipants) == 0 {
		return nil, ErrValidation
	}
	return selectedParticipants, nil
}

func AllocateEqualExpenseSplits(amountMinor int64, participants []ExpenseSplitParticipant) ([]CreateExpenseSplitRecord, error) {
	if amountMinor < 1 {
		return nil, ErrValidation
	}
	if len(participants) == 0 {
		return nil, ErrConflict
	}

	ordered := append([]ExpenseSplitParticipant(nil), participants...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if !ordered[i].JoinedAt.Equal(ordered[j].JoinedAt) {
			return ordered[i].JoinedAt.Before(ordered[j].JoinedAt)
		}
		return ordered[i].ParticipantID < ordered[j].ParticipantID
	})

	participantCount := int64(len(ordered))
	base := amountMinor / participantCount
	remainder := amountMinor % participantCount
	splits := make([]CreateExpenseSplitRecord, 0, len(ordered))
	for index, participant := range ordered {
		amount := base
		if int64(index) < remainder {
			amount++
		}
		splits = append(splits, CreateExpenseSplitRecord{
			ParticipantID:          participant.ParticipantID,
			ParticipantDisplayName: participantDisplayName(participant.DisplayName),
			AmountMinor:            amount,
			SplitOrder:             index + 1,
		})
	}
	return splits, nil
}

func participantDisplayName(value string) string {
	return NormalizeParticipantDisplayName(value)
}
