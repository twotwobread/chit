package trip

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
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

type tripSettlementInputsRepository interface {
	GetTripSettlementInputs(ctx context.Context, tripIDs []string) (map[string]SettlementInput, error)
}

type tripParticipantSummaryRepository interface {
	GetTripParticipantSummary(ctx context.Context, tripID string) (ParticipantSummary, error)
}

type ServiceOption func(*Service)

func WithInviteBaseURL(value string) ServiceOption {
	return func(s *Service) {
		if strings.TrimSpace(value) != "" {
			s.inviteBaseURL = strings.TrimRight(strings.TrimSpace(value), "/")
		}
	}
}

func WithToday(today func() time.Time) ServiceOption {
	return func(s *Service) {
		if today != nil {
			s.today = today
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

	destinations, err := normalizeCreateDestinations(input.Destinations)
	if err != nil {
		return CreateResult{}, err
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
		Destinations:     destinations,
	})
}

func (s *Service) List(ctx context.Context, userID string) ([]ListItem, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrUnauthorized
	}

	return s.repo.ListTripsByParticipantUser(ctx, userID)
}

func (s *Service) GetMySettlementSummary(ctx context.Context, userID string) (GetMySettlementSummaryResult, error) {
	if strings.TrimSpace(userID) == "" {
		return GetMySettlementSummaryResult{}, ErrUnauthorized
	}

	trips, err := s.repo.ListTripsByParticipantUser(ctx, userID)
	if err != nil {
		return GetMySettlementSummaryResult{}, err
	}

	settlementInputs, err := s.getTripSettlementInputs(ctx, trips)
	if err != nil {
		return GetMySettlementSummaryResult{}, err
	}

	result := GetMySettlementSummaryResult{Trips: []MySettlementTripSummary{}}
	for _, listItem := range trips {
		participantID := strings.TrimSpace(listItem.ParticipantID)
		if participantID == "" {
			return GetMySettlementSummaryResult{}, ErrSettlementSummaryUnavailable
		}

		settlement, err := BuildTripSettlement(listItem.ID, listItem.DefaultCurrency, settlementInputs[listItem.ID])
		if err != nil {
			if errors.Is(err, ErrSettlementDataInconsistent) {
				return GetMySettlementSummaryResult{}, ErrSettlementSummaryUnavailable
			}
			return GetMySettlementSummaryResult{}, err
		}

		tripSummary := MySettlementTripSummary{
			TripID:            listItem.ID,
			TripName:          listItem.Name,
			StartDate:         listItem.StartDate,
			EndDate:           listItem.EndDate,
			DefaultCurrency:   listItem.DefaultCurrency,
			CurrencySummaries: []MySettlementCurrencySummary{},
		}
		for _, currencySummary := range settlement.CurrencySummaries {
			for _, balance := range currencySummary.Balances {
				if balance.Participant.ParticipantID == nil || *balance.Participant.ParticipantID != participantID {
					continue
				}
				if balance.NetMinor != 0 {
					tripSummary.CurrencySummaries = append(tripSummary.CurrencySummaries, mySettlementCurrencySummary(currencySummary.Currency, balance.NetMinor))
				}
				break
			}
		}
		if len(tripSummary.CurrencySummaries) > 0 {
			result.Trips = append(result.Trips, tripSummary)
		}
	}

	return result, nil
}

func (s *Service) getTripSettlementInputs(ctx context.Context, trips []ListItem) (map[string]SettlementInput, error) {
	tripIDs := make([]string, 0, len(trips))
	for _, listItem := range trips {
		tripIDs = append(tripIDs, listItem.ID)
	}

	if batchRepo, ok := s.repo.(tripSettlementInputsRepository); ok {
		return batchRepo.GetTripSettlementInputs(ctx, tripIDs)
	}

	inputs := make(map[string]SettlementInput, len(tripIDs))
	for _, tripID := range tripIDs {
		input, err := s.repo.GetTripSettlementInput(ctx, tripID)
		if err != nil {
			return nil, err
		}
		inputs[tripID] = input
	}
	return inputs, nil
}

func mySettlementCurrencySummary(currency string, netMinor int64) MySettlementCurrencySummary {
	if netMinor > 0 {
		return MySettlementCurrencySummary{Currency: currency, Direction: MySettlementDirectionReceive, NetMinor: netMinor}
	}
	return MySettlementCurrencySummary{Currency: currency, Direction: MySettlementDirectionSend, NetMinor: -netMinor}
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

	participantSummary, err := s.getTripParticipantSummary(ctx, tripID)
	if err != nil {
		return GetDetailResult{}, err
	}

	days, err := s.repo.ListActiveTripDaysByTrip(ctx, tripID)
	if err != nil {
		return GetDetailResult{}, err
	}

	return GetDetailResult{
		Trip:               foundTrip,
		ParticipantSummary: participantSummary,
		Days:               days,
	}, nil
}

func (s *Service) getTripParticipantSummary(ctx context.Context, tripID string) (ParticipantSummary, error) {
	var summary ParticipantSummary
	if summaryRepo, ok := s.repo.(tripParticipantSummaryRepository); ok {
		var err error
		summary, err = summaryRepo.GetTripParticipantSummary(ctx, tripID)
		if err != nil {
			return ParticipantSummary{}, err
		}
	} else {
		totalCount, err := s.repo.CountTripParticipants(ctx, tripID)
		if err != nil {
			return ParticipantSummary{}, err
		}

		previewNames, err := s.repo.ListTripParticipantPreviewNames(ctx, tripID)
		if err != nil {
			return ParticipantSummary{}, err
		}
		summary = ParticipantSummary{TotalCount: totalCount, PreviewNames: previewNames}
	}

	for index, name := range summary.PreviewNames {
		summary.PreviewNames[index] = participantDisplayName(name)
	}
	summary.OverflowCount = summary.TotalCount - len(summary.PreviewNames)
	if summary.OverflowCount < 0 {
		summary.OverflowCount = 0
	}
	return summary, nil
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

func (s *Service) GetTripSettlement(ctx context.Context, userID string, tripID string) (GetTripSettlementResult, error) {
	if strings.TrimSpace(userID) == "" {
		return GetTripSettlementResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return GetTripSettlementResult{}, ErrValidation
	}

	foundTrip, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return GetTripSettlementResult{}, err
	}
	if !ok {
		return GetTripSettlementResult{}, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return GetTripSettlementResult{}, err
	}
	if !isParticipant {
		return GetTripSettlementResult{}, ErrForbidden
	}

	input, err := s.repo.GetTripSettlementInput(ctx, tripID)
	if err != nil {
		return GetTripSettlementResult{}, err
	}
	return BuildTripSettlement(foundTrip.ID, foundTrip.DefaultCurrency, input)
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

func (s *Service) ListTripScheduleItems(ctx context.Context, userID string, tripID string) (ListTripScheduleItemsResult, error) {
	if strings.TrimSpace(userID) == "" {
		return ListTripScheduleItemsResult{}, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return ListTripScheduleItemsResult{}, ErrValidation
	}

	_, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return ListTripScheduleItemsResult{}, err
	}
	if !ok {
		return ListTripScheduleItemsResult{}, ErrNotFound
	}
	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return ListTripScheduleItemsResult{}, err
	}
	if !isParticipant {
		return ListTripScheduleItemsResult{}, ErrForbidden
	}

	days, err := s.repo.ListTripScheduleItems(ctx, tripID)
	if err != nil {
		return ListTripScheduleItemsResult{}, err
	}
	return ListTripScheduleItemsResult{Days: days}, nil
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

func (s *Service) ListTripExpenses(ctx context.Context, userID string, tripID string) (ListTripExpensesResult, error) {
	if strings.TrimSpace(userID) == "" {
		return ListTripExpensesResult{}, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return ListTripExpensesResult{}, ErrValidation
	}

	_, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return ListTripExpensesResult{}, err
	}
	if !ok {
		return ListTripExpensesResult{}, ErrNotFound
	}
	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return ListTripExpensesResult{}, err
	}
	if !isParticipant {
		return ListTripExpensesResult{}, ErrForbidden
	}

	result, err := s.repo.ListTripExpenses(ctx, tripID)
	if err != nil {
		return ListTripExpensesResult{}, err
	}
	return result, nil
}

func (s *Service) GetDayExpense(ctx context.Context, userID string, tripID string, tripDayID string, expenseID string) (GetExpenseResult, error) {
	expenseID = strings.TrimSpace(expenseID)
	if !isUUID(expenseID) {
		return GetExpenseResult{}, ErrValidation
	}
	if _, err := s.activeTripDay(ctx, userID, tripID, tripDayID); err != nil {
		return GetExpenseResult{}, err
	}

	expense, ok, err := s.repo.GetExpenseByTripDayAndID(ctx, strings.TrimSpace(tripID), strings.TrimSpace(tripDayID), expenseID)
	if err != nil {
		return GetExpenseResult{}, err
	}
	if !ok {
		return GetExpenseResult{}, ErrNotFound
	}
	return GetExpenseResult{Expense: expense}, nil
}

func (s *Service) GetTripExpense(ctx context.Context, userID string, tripID string, expenseID string) (GetExpenseResult, error) {
	expenseID = strings.TrimSpace(expenseID)
	if !isUUID(expenseID) {
		return GetExpenseResult{}, ErrValidation
	}
	tripID, err := s.authorizedTrip(ctx, userID, tripID)
	if err != nil {
		return GetExpenseResult{}, err
	}

	expense, ok, err := s.repo.GetTripExpenseByID(ctx, tripID, expenseID)
	if err != nil {
		return GetExpenseResult{}, err
	}
	if !ok {
		return GetExpenseResult{}, ErrNotFound
	}
	return GetExpenseResult{Expense: expense}, nil
}

func (s *Service) UpdateTripExpense(ctx context.Context, userID string, tripID string, expenseID string, input UpdateExpenseInput) (UpdateExpenseResult, error) {
	expenseID = strings.TrimSpace(expenseID)
	payerParticipantID := strings.TrimSpace(input.PayerParticipantID)
	splitPolicy, participantIDs, manualSplits, err := normalizeExpenseSplitInput(input.SplitPolicy, input.ParticipantIDs, input.ManualSplits, input.AmountMinor)
	if err != nil {
		return UpdateExpenseResult{}, err
	}
	if !isUUID(expenseID) || !isUUID(payerParticipantID) || input.AmountMinor < 1 {
		return UpdateExpenseResult{}, ErrValidation
	}
	if input.ScheduleItemID != nil {
		return UpdateExpenseResult{}, ErrValidation
	}
	memo, err := normalizeExpenseMemo(input.Memo)
	if err != nil {
		return UpdateExpenseResult{}, err
	}
	title, err := normalizeExpenseTitle(input.Title, true)
	if err != nil {
		return UpdateExpenseResult{}, err
	}
	tripID, err = s.authorizedTrip(ctx, userID, tripID)
	if err != nil {
		return UpdateExpenseResult{}, err
	}

	expense, err := s.repo.UpdateTripExpense(ctx, UpdateExpenseRecord{
		TripID:             tripID,
		ExpenseID:          expenseID,
		AmountMinor:        input.AmountMinor,
		PayerParticipantID: payerParticipantID,
		SplitPolicy:        splitPolicy,
		ParticipantIDs:     participantIDs,
		ManualSplits:       manualSplits,
		Memo:               memo,
		Title:              title,
		ScheduleItemID:     nil,
	})
	if err != nil {
		return UpdateExpenseResult{}, err
	}
	return UpdateExpenseResult{Expense: expense}, nil
}

func (s *Service) DeleteTripExpense(ctx context.Context, userID string, tripID string, expenseID string) error {
	expenseID = strings.TrimSpace(expenseID)
	if !isUUID(expenseID) {
		return ErrValidation
	}
	tripID, err := s.authorizedTrip(ctx, userID, tripID)
	if err != nil {
		return err
	}
	deleted, err := s.repo.DeleteTripExpenseByID(ctx, tripID, expenseID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

func (s *Service) UpdateExpense(ctx context.Context, userID string, tripID string, tripDayID string, expenseID string, input UpdateExpenseInput) (UpdateExpenseResult, error) {
	expenseID = strings.TrimSpace(expenseID)
	payerParticipantID := strings.TrimSpace(input.PayerParticipantID)
	splitPolicy, participantIDs, manualSplits, err := normalizeExpenseSplitInput(input.SplitPolicy, input.ParticipantIDs, input.ManualSplits, input.AmountMinor)
	if err != nil {
		return UpdateExpenseResult{}, err
	}
	if !isUUID(expenseID) || !isUUID(payerParticipantID) || input.AmountMinor < 1 {
		return UpdateExpenseResult{}, ErrValidation
	}
	var scheduleItemID *string
	if input.ScheduleItemID != nil {
		trimmedScheduleItemID := strings.TrimSpace(*input.ScheduleItemID)
		if !isUUID(trimmedScheduleItemID) {
			return UpdateExpenseResult{}, ErrValidation
		}
		scheduleItemID = &trimmedScheduleItemID
	}
	memo, err := normalizeExpenseMemo(input.Memo)
	if err != nil {
		return UpdateExpenseResult{}, err
	}
	title, err := normalizeExpenseTitle(input.Title, false)
	if err != nil {
		return UpdateExpenseResult{}, err
	}
	if _, err := s.activeTripDay(ctx, userID, tripID, tripDayID); err != nil {
		return UpdateExpenseResult{}, err
	}

	expense, err := s.repo.UpdateExpense(ctx, UpdateExpenseRecord{
		TripID:             strings.TrimSpace(tripID),
		TripDayID:          strings.TrimSpace(tripDayID),
		ExpenseID:          expenseID,
		AmountMinor:        input.AmountMinor,
		PayerParticipantID: payerParticipantID,
		SplitPolicy:        splitPolicy,
		ParticipantIDs:     participantIDs,
		ManualSplits:       manualSplits,
		Memo:               memo,
		Title:              title,
		ScheduleItemID:     scheduleItemID,
	})
	if err != nil {
		return UpdateExpenseResult{}, err
	}
	return UpdateExpenseResult{Expense: expense}, nil
}

func (s *Service) DeleteExpense(ctx context.Context, userID string, tripID string, tripDayID string, expenseID string) error {
	expenseID = strings.TrimSpace(expenseID)
	if !isUUID(expenseID) {
		return ErrValidation
	}
	if _, err := s.activeTripDay(ctx, userID, tripID, tripDayID); err != nil {
		return err
	}
	deleted, err := s.repo.DeleteExpenseByTripDayAndID(ctx, strings.TrimSpace(tripID), strings.TrimSpace(tripDayID), expenseID)
	if err != nil {
		return err
	}
	if !deleted {
		return ErrNotFound
	}
	return nil
}

func (s *Service) CreateQuickExpense(ctx context.Context, userID string, tripID string, tripDayID string, input CreateQuickExpenseInput) (CreateQuickExpenseResult, error) {
	scheduleItemID := strings.TrimSpace(input.ScheduleItemID)
	payerParticipantID := strings.TrimSpace(input.PayerParticipantID)
	splitPolicy, participantIDs, manualSplits, err := normalizeExpenseSplitInput(input.SplitPolicy, input.ParticipantIDs, input.ManualSplits, input.AmountMinor)
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
		SplitPolicy:        splitPolicy,
		ParticipantIDs:     participantIDs,
		ManualSplits:       manualSplits,
		CreatedBy:          userID,
	})
}

func (s *Service) CreateTripExpense(ctx context.Context, userID string, tripID string, input CreateTripExpenseInput) (CreateTripExpenseResult, error) {
	if strings.TrimSpace(userID) == "" {
		return CreateTripExpenseResult{}, ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return CreateTripExpenseResult{}, ErrValidation
	}

	payerParticipantID := strings.TrimSpace(input.PayerParticipantID)
	if !isUUID(payerParticipantID) || input.AmountMinor < 1 {
		return CreateTripExpenseResult{}, ErrValidation
	}
	expenseDate, err := parseDate(input.ExpenseDate)
	if err != nil {
		return CreateTripExpenseResult{}, ErrValidation
	}

	var tripDayID *string
	if input.TripDayID != nil {
		trimmedTripDayID := strings.TrimSpace(*input.TripDayID)
		if !isUUID(trimmedTripDayID) {
			return CreateTripExpenseResult{}, ErrValidation
		}
		tripDayID = &trimmedTripDayID
	}
	var scheduleItemID *string
	if input.ScheduleItemID != nil {
		trimmedScheduleItemID := strings.TrimSpace(*input.ScheduleItemID)
		if !isUUID(trimmedScheduleItemID) {
			return CreateTripExpenseResult{}, ErrValidation
		}
		scheduleItemID = &trimmedScheduleItemID
	}

	title, err := normalizeExpenseTitle(input.Title, scheduleItemID == nil)
	if err != nil {
		return CreateTripExpenseResult{}, err
	}
	memo, err := normalizeExpenseMemo(input.Memo)
	if err != nil {
		return CreateTripExpenseResult{}, err
	}
	splitPolicy, participantIDs, manualSplits, err := normalizeExpenseSplitInput(input.SplitPolicy, input.ParticipantIDs, input.ManualSplits, input.AmountMinor)
	if err != nil {
		return CreateTripExpenseResult{}, err
	}

	_, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return CreateTripExpenseResult{}, err
	}
	if !ok {
		return CreateTripExpenseResult{}, ErrNotFound
	}
	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return CreateTripExpenseResult{}, err
	}
	if !isParticipant {
		return CreateTripExpenseResult{}, ErrForbidden
	}
	if tripDayID != nil && scheduleItemID == nil {
		if _, ok, err := s.repo.GetActiveTripDayByTripAndID(ctx, tripID, *tripDayID); err != nil {
			return CreateTripExpenseResult{}, err
		} else if !ok {
			return CreateTripExpenseResult{}, ErrNotFound
		}
	}

	return s.repo.CreateTripExpense(ctx, CreateTripExpenseRecord{
		TripID:             tripID,
		Title:              title,
		ExpenseDate:        expenseDate,
		TripDayID:          tripDayID,
		ScheduleItemID:     scheduleItemID,
		AmountMinor:        input.AmountMinor,
		PayerParticipantID: payerParticipantID,
		SplitPolicy:        splitPolicy,
		ParticipantIDs:     participantIDs,
		ManualSplits:       manualSplits,
		Memo:               memo,
		CreatedBy:          userID,
	})
}

func normalizeExpenseTitle(value *string, required bool) (*string, error) {
	if value == nil {
		if required {
			return nil, ErrValidation
		}
		return nil, nil
	}
	title := strings.TrimSpace(*value)
	if title == "" {
		if required {
			return nil, ErrValidation
		}
		return nil, nil
	}
	if len([]rune(title)) > 120 {
		return nil, ErrValidation
	}
	return &title, nil
}

func normalizeExpenseMemo(value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}
	memo := strings.TrimSpace(*value)
	if memo == "" {
		return nil, nil
	}
	if len([]rune(memo)) > 240 {
		return nil, ErrValidation
	}
	return &memo, nil
}

func normalizeExpenseSplitInput(policy string, participantIDs []string, manualSplits []ManualExpenseSplitInput, amountMinor int64) (string, []string, []ManualExpenseSplitInput, error) {
	if amountMinor < 1 {
		return "", nil, nil, ErrValidation
	}

	splitPolicy := strings.ToLower(strings.TrimSpace(policy))
	switch splitPolicy {
	case ExpenseSplitPolicyEqual:
		if manualSplits != nil {
			return "", nil, nil, ErrValidation
		}
		normalizedParticipantIDs, err := normalizeQuickExpenseParticipantIDs(participantIDs)
		if err != nil {
			return "", nil, nil, err
		}
		return splitPolicy, normalizedParticipantIDs, nil, nil
	case ExpenseSplitPolicyManual:
		if participantIDs != nil {
			return "", nil, nil, ErrValidation
		}
		normalizedManualSplits, err := normalizeManualExpenseSplits(manualSplits, amountMinor)
		if err != nil {
			return "", nil, nil, err
		}
		return splitPolicy, nil, normalizedManualSplits, nil
	default:
		return "", nil, nil, ErrValidation
	}
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

func normalizeManualExpenseSplits(manualSplits []ManualExpenseSplitInput, amountMinor int64) ([]ManualExpenseSplitInput, error) {
	if len(manualSplits) == 0 {
		return nil, ErrValidation
	}

	seen := make(map[string]struct{}, len(manualSplits))
	normalized := make([]ManualExpenseSplitInput, 0, len(manualSplits))
	var total int64
	for _, rawSplit := range manualSplits {
		participantID := strings.ToLower(strings.TrimSpace(rawSplit.ParticipantID))
		if !isUUID(participantID) || rawSplit.AmountMinor < 1 {
			return nil, ErrValidation
		}
		if _, ok := seen[participantID]; ok {
			return nil, ErrValidation
		}
		seen[participantID] = struct{}{}
		total += rawSplit.AmountMinor
		if total > amountMinor {
			return nil, ErrValidation
		}
		normalized = append(normalized, ManualExpenseSplitInput{ParticipantID: participantID, AmountMinor: rawSplit.AmountMinor})
	}
	if total != amountMinor {
		return nil, ErrValidation
	}
	return normalized, nil
}

func (s *Service) ListTripPlaces(ctx context.Context, userID string, tripID string) (ListTripPlacesResult, error) {
	if strings.TrimSpace(userID) == "" {
		return ListTripPlacesResult{}, ErrUnauthorized
	}

	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return ListTripPlacesResult{}, ErrValidation
	}

	_, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return ListTripPlacesResult{}, err
	}
	if !ok {
		return ListTripPlacesResult{}, ErrNotFound
	}

	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return ListTripPlacesResult{}, err
	}
	if !isParticipant {
		return ListTripPlacesResult{}, ErrForbidden
	}

	places, err := s.repo.ListTripPlaces(ctx, tripID)
	if err != nil {
		return ListTripPlacesResult{}, err
	}
	return ListTripPlacesResult{Places: places}, nil
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

func (s *Service) CreateManualDayLodgingPlace(ctx context.Context, userID string, tripID string, tripDayID string, input CreateManualDayLodgingPlaceInput) (CreateManualDayLodgingPlaceResult, error) {
	day, err := s.activeTripDay(ctx, userID, tripID, tripDayID)
	if err != nil {
		return CreateManualDayLodgingPlaceResult{}, err
	}

	name := strings.TrimSpace(input.Name)
	if len([]rune(name)) < 1 || len([]rune(name)) > 120 {
		return CreateManualDayLodgingPlaceResult{}, ErrValidation
	}
	address := strings.TrimSpace(input.Address)
	if len([]rune(address)) < 1 || len([]rune(address)) > 300 {
		return CreateManualDayLodgingPlaceResult{}, ErrValidation
	}

	lodgingPlace, err := s.repo.CreateManualDayLodgingPlace(ctx, CreateManualDayLodgingPlaceRecord{TripID: strings.TrimSpace(tripID), TripDayID: strings.TrimSpace(tripDayID), Name: name, Address: address})
	if err != nil {
		return CreateManualDayLodgingPlaceResult{}, err
	}
	day.LodgingPlace = &lodgingPlace
	return CreateManualDayLodgingPlaceResult{Day: day, LodgingPlace: lodgingPlace}, nil
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

func (s *Service) MoveScheduleItemToDay(ctx context.Context, userID string, tripID string, sourceTripDayID string, scheduleItemID string, input MoveScheduleItemToDayInput) (MoveScheduleItemToDayResult, error) {
	sourceDay, err := s.activeTripDay(ctx, userID, tripID, sourceTripDayID)
	if err != nil {
		return MoveScheduleItemToDayResult{}, err
	}
	targetDay, err := s.activeTripDay(ctx, userID, tripID, input.TargetTripDayID)
	if err != nil {
		return MoveScheduleItemToDayResult{}, err
	}

	tripID = strings.TrimSpace(tripID)
	sourceTripDayID = strings.TrimSpace(sourceTripDayID)
	targetTripDayID := strings.TrimSpace(input.TargetTripDayID)
	scheduleItemID = strings.TrimSpace(scheduleItemID)
	if sourceTripDayID == targetTripDayID || !isUUID(scheduleItemID) || input.ClientVersion < 1 {
		return MoveScheduleItemToDayResult{}, ErrValidation
	}

	mutation, err := s.repo.MoveScheduleItemToDay(ctx, MoveScheduleItemToDayRecord{
		TripID:          tripID,
		SourceTripDayID: sourceTripDayID,
		TargetTripDayID: targetTripDayID,
		ScheduleItemID:  scheduleItemID,
		ClientVersion:   input.ClientVersion,
	})
	if err != nil {
		return MoveScheduleItemToDayResult{}, err
	}

	return MoveScheduleItemToDayResult{
		SourceDay:   sourceDay,
		SourceItems: mutation.SourceItems,
		TargetDay:   targetDay,
		TargetItems: mutation.TargetItems,
		MovedItem:   mutation.MovedItem,
	}, nil
}

func (s *Service) authorizedTrip(ctx context.Context, userID string, tripID string) (string, error) {
	if strings.TrimSpace(userID) == "" {
		return "", ErrUnauthorized
	}
	tripID = strings.TrimSpace(tripID)
	if !isUUID(tripID) {
		return "", ErrValidation
	}
	_, ok, err := s.repo.GetTripByID(ctx, tripID)
	if err != nil {
		return "", err
	}
	if !ok {
		return "", ErrNotFound
	}
	isParticipant, err := s.repo.IsTripParticipant(ctx, tripID, userID)
	if err != nil {
		return "", err
	}
	if !isParticipant {
		return "", ErrForbidden
	}
	return tripID, nil
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
	return input.Name == nil && input.Address == nil && input.PlaceType == nil && input.StartTime == nil && input.EndTime == nil && input.Memo == nil
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
	if input.StartTime != nil {
		if _, err := normalizeOptionalScheduleItemTime(*input.StartTime); err != nil {
			return err
		}
	}
	if input.EndTime != nil {
		if _, err := normalizeOptionalScheduleItemTime(*input.EndTime); err != nil {
			return err
		}
	}
	if input.Memo != nil {
		if _, err := normalizeOptionalText(*input.Memo, 1000); err != nil {
			return err
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

	startTime := foundItem.StartTime
	endTime := foundItem.EndTime
	if input.StartTime != nil {
		normalized, err := normalizeOptionalScheduleItemTime(*input.StartTime)
		if err != nil {
			return UpdateScheduleItemRecord{}, err
		}
		startTime = normalized
		if startTime == nil {
			endTime = nil
		}
	}
	if input.EndTime != nil {
		normalized, err := normalizeOptionalScheduleItemTime(*input.EndTime)
		if err != nil {
			return UpdateScheduleItemRecord{}, err
		}
		endTime = normalized
	}
	if endTime != nil && startTime == nil {
		return UpdateScheduleItemRecord{}, ErrValidation
	}
	if startTime != nil && endTime != nil && *endTime <= *startTime {
		return UpdateScheduleItemRecord{}, ErrValidation
	}

	var memo *string
	if foundItem.PlaceSchedule != nil {
		memo = foundItem.PlaceSchedule.Memo
	}
	if input.Memo != nil {
		normalized, err := normalizeOptionalText(*input.Memo, 1000)
		if err != nil {
			return UpdateScheduleItemRecord{}, err
		}
		memo = normalized
	}

	return UpdateScheduleItemRecord{
		TripID:    tripID,
		TripDayID: tripDayID,
		ItemID:    itemID,
		Name:      name,
		Address:   address,
		PlaceType: placeType,
		StartTime: startTime,
		EndTime:   endTime,
		Memo:      memo,
	}, nil
}

func normalizeScheduleItemTimePair(currentStart *string, currentEnd *string, patchStart *string, patchEnd *string) (*string, *string, error) {
	startTime := currentStart
	endTime := currentEnd
	if patchStart != nil {
		normalized, err := normalizeOptionalScheduleItemTime(*patchStart)
		if err != nil {
			return nil, nil, err
		}
		startTime = normalized
		if startTime == nil {
			endTime = nil
		}
	}
	if patchEnd != nil {
		normalized, err := normalizeOptionalScheduleItemTime(*patchEnd)
		if err != nil {
			return nil, nil, err
		}
		endTime = normalized
	}
	if endTime != nil && startTime == nil {
		return nil, nil, ErrValidation
	}
	if startTime != nil && endTime != nil && *endTime <= *startTime {
		return nil, nil, ErrValidation
	}
	return startTime, endTime, nil
}

func normalizeOptionalText(value string, maxLength int) (*string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	if len([]rune(trimmed)) > maxLength {
		return nil, ErrValidation
	}
	return &trimmed, nil
}

func scheduleItemType(item ScheduleItem) string {
	if item.ItemType == "" {
		return ScheduleItemTypePlace
	}
	return item.ItemType
}

func normalizeOptionalScheduleItemTime(value string) (*string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	if len(trimmed) != 5 || trimmed[2] != ':' {
		return nil, ErrValidation
	}
	if _, err := time.Parse("15:04", trimmed); err != nil {
		return nil, ErrValidation
	}
	return &trimmed, nil
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

func normalizeCreateDestinations(inputs []CreateDestinationInput) ([]CreateDestinationRecord, error) {
	if len(inputs) < 1 || len(inputs) > 5 {
		return nil, ErrValidation
	}
	seen := make(map[string]struct{}, len(inputs))
	records := make([]CreateDestinationRecord, 0, len(inputs))
	for index, input := range inputs {
		cityName := strings.TrimSpace(input.CityName)
		countryName := strings.TrimSpace(input.CountryName)
		countryCode := strings.ToUpper(strings.TrimSpace(input.CountryCode))
		displayName := strings.TrimSpace(input.DisplayName)
		provider := strings.TrimSpace(input.Provider)
		providerPlaceID := strings.TrimSpace(input.ProviderPlaceID)
		if len([]rune(cityName)) < 1 || len([]rune(cityName)) > 120 || len([]rune(countryName)) < 1 || len([]rune(countryName)) > 120 || len([]rune(displayName)) < 1 || len([]rune(displayName)) > 160 {
			return nil, ErrValidation
		}
		if !isCountryCode(countryCode) || provider != DestinationProviderGoogle || len([]rune(providerPlaceID)) < 1 || len([]rune(providerPlaceID)) > 255 {
			return nil, ErrValidation
		}
		if input.Latitude < -90 || input.Latitude > 90 || input.Longitude < -180 || input.Longitude > 180 || input.RadiusMeters < 1 || input.RadiusMeters > 500000 {
			return nil, ErrValidation
		}
		key := provider + ":" + providerPlaceID
		if _, ok := seen[key]; ok {
			return nil, ErrValidation
		}
		seen[key] = struct{}{}
		records = append(records, CreateDestinationRecord{
			CityName:        cityName,
			CountryName:     countryName,
			CountryCode:     countryCode,
			DisplayName:     displayName,
			Latitude:        input.Latitude,
			Longitude:       input.Longitude,
			RadiusMeters:    input.RadiusMeters,
			Provider:        provider,
			ProviderPlaceID: providerPlaceID,
			SortOrder:       index,
		})
	}
	return records, nil
}

func isCountryCode(value string) bool {
	if len(value) != 2 {
		return false
	}
	for _, char := range value {
		if char < 'A' || char > 'Z' {
			return false
		}
	}
	return true
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
	case "sights", "food", "lodging", "cafe", "shopping", "transport", "etc":
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

func BuildTripSettlement(tripID string, defaultCurrency string, input SettlementInput) (GetTripSettlementResult, error) {
	currentParticipants := orderedSettlementParticipants(input.Participants)
	participantByID := make(map[string]SettlementParticipantInput, len(currentParticipants))
	for _, participant := range currentParticipants {
		participantByID[participant.ParticipantID] = participant
	}

	summariesByCurrency := make(map[string]*settlementCurrencyAccumulator)
	for _, expense := range input.Expenses {
		if expense.AmountMinor < 1 || !isSupportedCurrency(expense.Currency) {
			return GetTripSettlementResult{}, ErrSettlementDataInconsistent
		}
		summary := summariesByCurrency[expense.Currency]
		if summary == nil {
			summary = newSettlementCurrencyAccumulator(expense.Currency, currentParticipants)
			summariesByCurrency[expense.Currency] = summary
		}
		summary.totalPaidMinor += expense.AmountMinor
		payerKey, payerRow := settlementRowForSnapshot(expense.PayerParticipantID, expense.PayerDisplayName, expense.PayerParticipantLive, participantByID)
		summary.addPaid(payerKey, payerRow, expense.AmountMinor)
		for _, split := range expense.Splits {
			if split.AmountMinor < 0 {
				return GetTripSettlementResult{}, ErrSettlementDataInconsistent
			}
			summary.totalShareMinor += split.AmountMinor
			if split.AmountMinor == 0 {
				continue
			}
			splitKey, splitRow := settlementRowForSnapshot(split.ParticipantID, split.DisplayName, split.ParticipantLive, participantByID)
			summary.addShare(splitKey, splitRow, split.AmountMinor)
		}
	}

	currencies := make([]string, 0, len(summariesByCurrency))
	for currency := range summariesByCurrency {
		currencies = append(currencies, currency)
	}
	sort.Slice(currencies, func(i, j int) bool {
		if currencies[i] == defaultCurrency && currencies[j] != defaultCurrency {
			return true
		}
		if currencies[j] == defaultCurrency && currencies[i] != defaultCurrency {
			return false
		}
		return currencies[i] < currencies[j]
	})

	result := GetTripSettlementResult{TripID: tripID, DefaultCurrency: defaultCurrency, CurrencySummaries: []SettlementCurrencySummary{}}
	for _, currency := range currencies {
		summary, err := summariesByCurrency[currency].build()
		if err != nil {
			return GetTripSettlementResult{}, err
		}
		result.CurrencySummaries = append(result.CurrencySummaries, summary)
	}
	return result, nil
}

type settlementParticipantRow struct {
	participant SettlementParticipantSnapshot
	paidMinor   int64
	shareMinor  int64
	current     bool
	joinedAt    time.Time
	orderKey    string
}

type settlementCurrencyAccumulator struct {
	currency        string
	totalPaidMinor  int64
	totalShareMinor int64
	rows            map[string]*settlementParticipantRow
}

func newSettlementCurrencyAccumulator(currency string, currentParticipants []SettlementParticipantInput) *settlementCurrencyAccumulator {
	rows := make(map[string]*settlementParticipantRow, len(currentParticipants))
	for _, participant := range currentParticipants {
		participantID := participant.ParticipantID
		key := settlementCurrentKey(participantID)
		rows[key] = &settlementParticipantRow{
			participant: SettlementParticipantSnapshot{
				ParticipantID:     &participantID,
				DisplayName:       participantDisplayName(participant.DisplayName),
				ParticipantStatus: SettlementParticipantStatusCurrent,
			},
			current:  true,
			joinedAt: participant.JoinedAt,
			orderKey: participant.ParticipantID,
		}
	}
	return &settlementCurrencyAccumulator{currency: currency, rows: rows}
}

func (s *settlementCurrencyAccumulator) addPaid(key string, row settlementParticipantRow, amountMinor int64) {
	existing := s.ensureRow(key, row)
	existing.paidMinor += amountMinor
}

func (s *settlementCurrencyAccumulator) addShare(key string, row settlementParticipantRow, amountMinor int64) {
	existing := s.ensureRow(key, row)
	existing.shareMinor += amountMinor
}

func (s *settlementCurrencyAccumulator) ensureRow(key string, row settlementParticipantRow) *settlementParticipantRow {
	if existing, ok := s.rows[key]; ok {
		return existing
	}
	copyRow := row
	s.rows[key] = &copyRow
	return &copyRow
}

func (s *settlementCurrencyAccumulator) build() (SettlementCurrencySummary, error) {
	if s.totalPaidMinor != s.totalShareMinor {
		return SettlementCurrencySummary{}, ErrSettlementDataInconsistent
	}

	rows := make([]settlementParticipantRow, 0, len(s.rows))
	var netTotal int64
	for _, row := range s.rows {
		netMinor := row.paidMinor - row.shareMinor
		if !row.current && row.paidMinor == 0 && row.shareMinor == 0 && netMinor == 0 {
			continue
		}
		rowCopy := *row
		rows = append(rows, rowCopy)
		netTotal += netMinor
	}
	if netTotal != 0 {
		return SettlementCurrencySummary{}, ErrSettlementDataInconsistent
	}

	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].current != rows[j].current {
			return rows[i].current
		}
		if rows[i].current {
			if !rows[i].joinedAt.Equal(rows[j].joinedAt) {
				return rows[i].joinedAt.Before(rows[j].joinedAt)
			}
			return rows[i].orderKey < rows[j].orderKey
		}
		if rows[i].participant.DisplayName != rows[j].participant.DisplayName {
			return rows[i].participant.DisplayName < rows[j].participant.DisplayName
		}
		return rows[i].orderKey < rows[j].orderKey
	})

	balances := make([]SettlementBalance, 0, len(rows))
	for _, row := range rows {
		balances = append(balances, SettlementBalance{
			Participant: row.participant,
			PaidMinor:   row.paidMinor,
			ShareMinor:  row.shareMinor,
			NetMinor:    row.paidMinor - row.shareMinor,
		})
	}

	return SettlementCurrencySummary{
		Currency:           s.currency,
		TotalPaidMinor:     s.totalPaidMinor,
		TotalShareMinor:    s.totalShareMinor,
		Balances:           balances,
		SuggestedTransfers: buildSettlementTransfers(balances),
	}, nil
}

type settlementRemainingBalance struct {
	balance   SettlementBalance
	remaining int64
	order     int
}

func buildSettlementTransfers(balances []SettlementBalance) []SettlementTransfer {
	creditors := make([]settlementRemainingBalance, 0)
	debtors := make([]settlementRemainingBalance, 0)
	for index, balance := range balances {
		switch {
		case balance.NetMinor > 0:
			creditors = append(creditors, settlementRemainingBalance{balance: balance, remaining: balance.NetMinor, order: index})
		case balance.NetMinor < 0:
			debtors = append(debtors, settlementRemainingBalance{balance: balance, remaining: -balance.NetMinor, order: index})
		}
	}
	compare := func(left, right settlementRemainingBalance) bool {
		if left.remaining != right.remaining {
			return left.remaining > right.remaining
		}
		return left.order < right.order
	}
	sort.SliceStable(creditors, func(i, j int) bool { return compare(creditors[i], creditors[j]) })
	sort.SliceStable(debtors, func(i, j int) bool { return compare(debtors[i], debtors[j]) })

	transfers := make([]SettlementTransfer, 0)
	debtorIndex := 0
	creditorIndex := 0
	for debtorIndex < len(debtors) && creditorIndex < len(creditors) {
		amount := debtors[debtorIndex].remaining
		if creditors[creditorIndex].remaining < amount {
			amount = creditors[creditorIndex].remaining
		}
		if amount > 0 {
			transfers = append(transfers, SettlementTransfer{
				FromParticipant: debtors[debtorIndex].balance.Participant,
				ToParticipant:   creditors[creditorIndex].balance.Participant,
				AmountMinor:     amount,
			})
		}
		debtors[debtorIndex].remaining -= amount
		creditors[creditorIndex].remaining -= amount
		if debtors[debtorIndex].remaining == 0 {
			debtorIndex++
		}
		if creditors[creditorIndex].remaining == 0 {
			creditorIndex++
		}
	}
	return transfers
}

func orderedSettlementParticipants(participants []SettlementParticipantInput) []SettlementParticipantInput {
	ordered := append([]SettlementParticipantInput(nil), participants...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if !ordered[i].JoinedAt.Equal(ordered[j].JoinedAt) {
			return ordered[i].JoinedAt.Before(ordered[j].JoinedAt)
		}
		return ordered[i].ParticipantID < ordered[j].ParticipantID
	})
	return ordered
}

func settlementRowForSnapshot(participantID *string, displayName string, participantLive bool, currentParticipants map[string]SettlementParticipantInput) (string, settlementParticipantRow) {
	if participantID != nil && participantLive {
		if participant, ok := currentParticipants[*participantID]; ok {
			participantIDCopy := participant.ParticipantID
			return settlementCurrentKey(participant.ParticipantID), settlementParticipantRow{
				participant: SettlementParticipantSnapshot{
					ParticipantID:     &participantIDCopy,
					DisplayName:       participantDisplayName(participant.DisplayName),
					ParticipantStatus: SettlementParticipantStatusCurrent,
				},
				current:  true,
				joinedAt: participant.JoinedAt,
				orderKey: participant.ParticipantID,
			}
		}
	}

	normalizedName := participantDisplayName(displayName)
	return settlementRemovedKey(normalizedName), settlementParticipantRow{
		participant: SettlementParticipantSnapshot{
			ParticipantID:     nil,
			DisplayName:       normalizedName,
			ParticipantStatus: SettlementParticipantStatusRemoved,
		},
		current:  false,
		orderKey: normalizedName,
	}
}

func settlementCurrentKey(participantID string) string {
	return "current:" + participantID
}

func settlementRemovedKey(displayName string) string {
	return "removed:" + displayName
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

func BuildExpenseSplitRecords(amountMinor int64, splitPolicy string, participants []ExpenseSplitParticipant, participantIDs []string, manualSplits []ManualExpenseSplitInput) ([]CreateExpenseSplitRecord, error) {
	switch splitPolicy {
	case ExpenseSplitPolicyEqual:
		selectedParticipants, err := SelectExpenseSplitParticipants(participants, participantIDs)
		if err != nil {
			return nil, err
		}
		return AllocateEqualExpenseSplits(amountMinor, selectedParticipants)
	case ExpenseSplitPolicyManual:
		return BuildManualExpenseSplits(amountMinor, participants, manualSplits)
	default:
		return nil, ErrValidation
	}
}

func BuildManualExpenseSplits(amountMinor int64, participants []ExpenseSplitParticipant, manualSplits []ManualExpenseSplitInput) ([]CreateExpenseSplitRecord, error) {
	if amountMinor < 1 || len(manualSplits) == 0 {
		return nil, ErrValidation
	}

	amountByParticipantID := make(map[string]int64, len(manualSplits))
	var total int64
	for _, split := range manualSplits {
		if split.ParticipantID == "" || split.AmountMinor < 1 {
			return nil, ErrValidation
		}
		if _, ok := amountByParticipantID[split.ParticipantID]; ok {
			return nil, ErrValidation
		}
		amountByParticipantID[split.ParticipantID] = split.AmountMinor
		total += split.AmountMinor
		if total > amountMinor {
			return nil, ErrValidation
		}
	}
	if total != amountMinor {
		return nil, ErrValidation
	}

	ordered := append([]ExpenseSplitParticipant(nil), participants...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if !ordered[i].JoinedAt.Equal(ordered[j].JoinedAt) {
			return ordered[i].JoinedAt.Before(ordered[j].JoinedAt)
		}
		return ordered[i].ParticipantID < ordered[j].ParticipantID
	})

	splitRecords := make([]CreateExpenseSplitRecord, 0, len(manualSplits))
	for _, participant := range ordered {
		amount, ok := amountByParticipantID[participant.ParticipantID]
		if !ok {
			continue
		}
		splitRecords = append(splitRecords, CreateExpenseSplitRecord{
			ParticipantID:          participant.ParticipantID,
			ParticipantDisplayName: participantDisplayName(participant.DisplayName),
			AmountMinor:            amount,
			SplitOrder:             len(splitRecords) + 1,
		})
		delete(amountByParticipantID, participant.ParticipantID)
	}
	if len(amountByParticipantID) > 0 || len(splitRecords) == 0 {
		return nil, ErrValidation
	}
	return splitRecords, nil
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
