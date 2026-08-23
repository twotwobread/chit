package server

import (
	"strings"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/twotwobread/i-um/apps/api/internal/auth"
	"github.com/twotwobread/i-um/apps/api/internal/meeting"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/place"
	"github.com/twotwobread/i-um/apps/api/internal/route"
	"github.com/twotwobread/i-um/apps/api/internal/trip"
)

func credentialFromOpenAPI(value openapi.OAuthCredential) auth.Credential {
	return auth.Credential{
		IdentityToken:     value.IdentityToken,
		AuthorizationCode: value.AuthorizationCode,
		Nonce:             value.Nonce,
		AccessToken:       value.AccessToken,
		DevSubject:        value.DevSubject,
		Email:             value.Email,
		EmailVerified:     value.EmailVerified,
		DisplayName:       value.DisplayName,
		AvatarURL:         value.AvatarUrl,
	}
}

func deviceFromOpenAPI(value *openapi.DeviceInfo, userAgent string) auth.Device {
	device := auth.Device{UserAgent: optionalString(userAgent)}
	if value != nil {
		device.DeviceName = value.DeviceName
		device.Platform = value.Platform
	}
	return device
}

func userToOpenAPI(user auth.User) openapi.AuthUser {
	return openapi.AuthUser{
		Id:          user.ID,
		DisplayName: user.DisplayName,
		Email:       user.Email,
		AvatarUrl:   user.AvatarURL,
	}
}

func tokensToOpenAPI(tokens auth.TokenPair) openapi.AuthTokens {
	return openapi.AuthTokens{
		AccessToken:           tokens.AccessToken,
		AccessTokenExpiresAt:  tokens.AccessTokenExpiresAt,
		RefreshToken:          tokens.RefreshToken,
		RefreshTokenExpiresAt: tokens.RefreshTokenExpiresAt,
	}
}

func listMeetingsResponseToOpenAPI(meetings []meeting.MeetingListItem) openapi.ListMeetingsResponse {
	items := make([]openapi.MeetingListItem, 0, len(meetings))
	for _, item := range meetings {
		items = append(items, openapi.MeetingListItem{
			Id:          item.ID,
			Name:        item.Name,
			Visibility:  openapi.MeetingVisibility(item.Visibility),
			MemberCount: item.MemberCount,
			MyRole:      openapi.MeetingMemberRole(item.MyRole),
			CreatedAt:   item.CreatedAt,
			UpdatedAt:   item.UpdatedAt,
		})
	}
	return openapi.ListMeetingsResponse{Meetings: items}
}

func createMeetingResponseToOpenAPI(result meeting.CreateMeetingResult) openapi.CreateMeetingResponse {
	return openapi.CreateMeetingResponse{Meeting: meetingToOpenAPI(result.Meeting), OwnerMember: meetingMemberToOpenAPI(result.OwnerMember)}
}

func getMeetingResponseToOpenAPI(result meeting.MeetingDetailResult) openapi.GetMeetingResponse {
	members := make([]openapi.MeetingMember, 0, len(result.Members))
	for _, member := range result.Members {
		members = append(members, meetingMemberToOpenAPI(member))
	}
	events := make([]openapi.Event, 0, len(result.Events))
	for _, event := range result.Events {
		events = append(events, eventToOpenAPI(event))
	}
	return openapi.GetMeetingResponse{Meeting: meetingToOpenAPI(result.Meeting), Members: members, Events: events}
}

func createEventResponseToOpenAPI(result meeting.CreateEventResult) openapi.CreateEventResponse {
	return openapi.CreateEventResponse{
		Event:            eventToOpenAPI(result.Event),
		Meeting:          meetingToOpenAPI(result.Meeting),
		OwnerParticipant: eventParticipantToOpenAPI(result.OwnerParticipant),
	}
}

func getEventResponseToOpenAPI(result meeting.EventDetailResult) openapi.GetEventResponse {
	return openapi.GetEventResponse{Event: eventToOpenAPI(result.Event), Meeting: meetingToOpenAPI(result.Meeting)}
}

func meetingToOpenAPI(value meeting.Meeting) openapi.Meeting {
	return openapi.Meeting{
		Id:         value.ID,
		Name:       value.Name,
		Visibility: openapi.MeetingVisibility(value.Visibility),
		CreatedBy:  value.CreatedBy,
		CreatedAt:  value.CreatedAt,
		UpdatedAt:  value.UpdatedAt,
	}
}

func meetingMemberToOpenAPI(value meeting.MeetingMember) openapi.MeetingMember {
	return openapi.MeetingMember{
		Id:          value.ID,
		MeetingId:   value.MeetingID,
		UserId:      value.UserID,
		Role:        openapi.MeetingMemberRole(value.Role),
		DisplayName: value.DisplayName,
		JoinedAt:    value.JoinedAt,
	}
}

func eventToOpenAPI(value meeting.Event) openapi.Event {
	return openapi.Event{
		Id:                value.ID,
		MeetingId:         value.MeetingID,
		MeetingName:       value.MeetingName,
		MeetingVisibility: openapi.MeetingVisibility(value.MeetingVisibility),
		EventType:         openapi.EventType(value.EventType),
		Title:             value.Title,
		StartDate:         dateToOpenAPI(value.StartDate),
		EndDate:           dateToOpenAPI(value.EndDate),
		DefaultCurrency:   openapi.SupportedCurrency(value.DefaultCurrency),
		Status:            openapi.EventStatus(value.Status),
		TripId:            value.TripID,
		CreatedBy:         value.CreatedBy,
		CreatedAt:         value.CreatedAt,
		UpdatedAt:         value.UpdatedAt,
	}
}

func eventParticipantToOpenAPI(value meeting.EventParticipant) openapi.EventParticipant {
	return openapi.EventParticipant{
		Id:              value.ID,
		EventId:         value.EventID,
		MeetingMemberId: value.MeetingMemberID,
		UserId:          value.UserID,
		Role:            openapi.MeetingMemberRole(value.Role),
		DisplayName:     value.DisplayName,
		JoinedAt:        value.JoinedAt,
	}
}

func listTripsResponseToOpenAPI(trips []trip.ListItem) openapi.ListTripsResponse {
	items := make([]openapi.TripListItem, 0, len(trips))
	for _, item := range trips {
		items = append(items, openapi.TripListItem{
			Id:                item.ID,
			Name:              item.Name,
			StartDate:         dateToOpenAPI(item.StartDate),
			EndDate:           dateToOpenAPI(item.EndDate),
			DefaultCurrency:   openapi.SupportedCurrency(item.DefaultCurrency),
			DefaultTravelMode: openapi.TripDefaultTravelMode(item.DefaultTravelMode),
			JoinedAt:          item.JoinedAt,
			CreatedAt:         item.CreatedAt,
			MyRole:            openapi.TripParticipantRole(item.MyRole),
			ParticipantCount:  item.ParticipantCount,
			EventContext:      tripEventContextToOpenAPI(item.EventContext),
		})
	}
	return openapi.ListTripsResponse{Trips: items}
}

func createTripMeetingContextFromOpenAPI(value *openapi.TripMeetingContextInput) trip.CreateMeetingContextInput {
	if value == nil {
		return trip.CreateMeetingContextInput{}
	}
	input := trip.CreateMeetingContextInput{Mode: string(value.Mode)}
	if value.MeetingId != nil {
		input.MeetingID = *value.MeetingId
	}
	if value.MeetingName != nil {
		input.MeetingName = *value.MeetingName
	}
	return input
}

func createDestinationsFromOpenAPI(values []openapi.TripDestinationInput) []trip.CreateDestinationInput {
	items := make([]trip.CreateDestinationInput, 0, len(values))
	for _, value := range values {
		items = append(items, trip.CreateDestinationInput{
			CityName:        value.CityName,
			CountryName:     value.CountryName,
			CountryCode:     value.CountryCode,
			DisplayName:     value.DisplayName,
			Latitude:        value.Latitude,
			Longitude:       value.Longitude,
			RadiusMeters:    value.RadiusMeters,
			Provider:        string(value.Provider),
			ProviderPlaceID: value.ProviderPlaceId,
		})
	}
	return items
}

func createTripResponseToOpenAPI(result trip.CreateResult) openapi.CreateTripResponse {
	return openapi.CreateTripResponse{
		Trip: tripToOpenAPI(result.Trip),
		OwnerParticipant: openapi.TripParticipant{
			Id:          result.OwnerParticipant.ID,
			TripId:      result.OwnerParticipant.TripID,
			UserId:      result.OwnerParticipant.UserID,
			Role:        openapi.TripParticipantRole(result.OwnerParticipant.Role),
			DisplayName: result.OwnerParticipant.DisplayName,
			JoinedAt:    result.OwnerParticipant.JoinedAt,
		},
	}
}

func getTripDetailResponseToOpenAPI(result trip.GetDetailResult) openapi.GetTripDetailResponse {
	return openapi.GetTripDetailResponse{
		Trip: tripToOpenAPI(result.Trip),
		ParticipantSummary: openapi.TripParticipantSummary{
			TotalCount:    result.ParticipantSummary.TotalCount,
			PreviewNames:  result.ParticipantSummary.PreviewNames,
			OverflowCount: result.ParticipantSummary.OverflowCount,
		},
		Days: tripDaysToOpenAPI(result.Days),
	}
}

func listTripParticipantsResponseToOpenAPI(result trip.ListParticipantsResult) openapi.ListTripParticipantsResponse {
	items := make([]openapi.TripParticipantListItem, 0, len(result.Participants))
	for _, participant := range result.Participants {
		items = append(items, openapi.TripParticipantListItem{
			ParticipantId: participant.ParticipantID,
			DisplayName:   participant.DisplayName,
			Role:          openapi.TripParticipantRole(participant.Role),
			JoinedAt:      participant.JoinedAt,
		})
	}
	return openapi.ListTripParticipantsResponse{CurrentUserParticipantId: result.CurrentUserParticipantID, Participants: items}
}

func getTripSettlementResponseToOpenAPI(result trip.GetTripSettlementResult) openapi.GetTripSettlementResponse {
	summaries := make([]openapi.SettlementCurrencySummary, 0, len(result.CurrencySummaries))
	for _, summary := range result.CurrencySummaries {
		balances := make([]openapi.SettlementBalance, 0, len(summary.Balances))
		for _, balance := range summary.Balances {
			balances = append(balances, openapi.SettlementBalance{
				Participant: settlementParticipantToOpenAPI(balance.Participant),
				PaidMinor:   balance.PaidMinor,
				ShareMinor:  balance.ShareMinor,
				NetMinor:    balance.NetMinor,
			})
		}

		transfers := make([]openapi.SettlementTransfer, 0, len(summary.SuggestedTransfers))
		for _, transfer := range summary.SuggestedTransfers {
			transfers = append(transfers, openapi.SettlementTransfer{
				FromParticipant: settlementParticipantToOpenAPI(transfer.FromParticipant),
				ToParticipant:   settlementParticipantToOpenAPI(transfer.ToParticipant),
				AmountMinor:     transfer.AmountMinor,
			})
		}

		summaries = append(summaries, openapi.SettlementCurrencySummary{
			Currency:           openapi.SupportedCurrency(summary.Currency),
			TotalPaidMinor:     summary.TotalPaidMinor,
			TotalShareMinor:    summary.TotalShareMinor,
			Balances:           balances,
			SuggestedTransfers: transfers,
		})
	}

	return openapi.GetTripSettlementResponse{
		TripId:            result.TripID,
		DefaultCurrency:   openapi.SupportedCurrency(result.DefaultCurrency),
		CurrencySummaries: summaries,
	}
}

func settlementParticipantToOpenAPI(participant trip.SettlementParticipantSnapshot) openapi.SettlementParticipantSnapshot {
	return openapi.SettlementParticipantSnapshot{
		ParticipantId:     participant.ParticipantID,
		DisplayName:       participant.DisplayName,
		ParticipantStatus: openapi.SettlementParticipantStatus(participant.ParticipantStatus),
	}
}

func getMySettlementSummaryResponseToOpenAPI(result trip.GetMySettlementSummaryResult) openapi.GetMySettlementSummaryResponse {
	trips := make([]openapi.MySettlementTripSummary, 0, len(result.Trips))
	for _, tripSummary := range result.Trips {
		currencySummaries := make([]openapi.MySettlementCurrencySummary, 0, len(tripSummary.CurrencySummaries))
		for _, currencySummary := range tripSummary.CurrencySummaries {
			currencySummaries = append(currencySummaries, openapi.MySettlementCurrencySummary{
				Currency:  openapi.SupportedCurrency(currencySummary.Currency),
				Direction: openapi.MySettlementDirection(currencySummary.Direction),
				NetMinor:  currencySummary.NetMinor,
			})
		}
		trips = append(trips, openapi.MySettlementTripSummary{
			TripId:            tripSummary.TripID,
			TripName:          tripSummary.TripName,
			StartDate:         dateToOpenAPI(tripSummary.StartDate),
			EndDate:           dateToOpenAPI(tripSummary.EndDate),
			DefaultCurrency:   openapi.SupportedCurrency(tripSummary.DefaultCurrency),
			CurrencySummaries: currencySummaries,
		})
	}
	return openapi.GetMySettlementSummaryResponse{Trips: trips}
}

func createTripInviteResponseToOpenAPI(result trip.CreateTripInviteResult) openapi.CreateTripInviteResponse {
	return openapi.CreateTripInviteResponse{
		Invite: openapi.TripInvite{
			Id:        result.Invite.ID,
			TripId:    result.Invite.TripID,
			Token:     result.Invite.Token,
			InviteUrl: result.Invite.InviteURL,
			ExpiresAt: result.Invite.ExpiresAt,
			CreatedAt: result.Invite.CreatedAt,
			CreatedBy: result.Invite.CreatedBy,
		},
		Created: result.Created,
	}
}

func acceptTripInviteResponseToOpenAPI(result trip.AcceptTripInviteResult) openapi.AcceptTripInviteResponse {
	return openapi.AcceptTripInviteResponse{
		TripId:          result.TripID,
		TripName:        result.TripName,
		Role:            openapi.TripParticipantRole(result.Role),
		AlreadyAccepted: result.AlreadyAccepted,
	}
}

func updateTripResponseToOpenAPI(result trip.UpdateResult) openapi.UpdateTripResponse {
	return openapi.UpdateTripResponse{Trip: tripToOpenAPI(result.Trip)}
}

func getDayScheduleResponseToOpenAPI(result trip.GetDayScheduleItemsResult) openapi.GetDayScheduleItemsResponse {
	items := make([]openapi.ScheduleItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayScheduleItemToOpenAPI(item))
	}
	return openapi.GetDayScheduleItemsResponse{
		Day:           tripDayToOpenAPI(result.Day),
		ScheduleItems: items,
	}
}

func listTripScheduleItemsResponseToOpenAPI(result trip.ListTripScheduleItemsResult) openapi.ListTripScheduleItemsResponse {
	days := make([]openapi.TripScheduleItemsDayListItem, 0, len(result.Days))
	for _, day := range result.Days {
		items := make([]openapi.ScheduleItem, 0, len(day.Items))
		for _, item := range day.Items {
			items = append(items, dayScheduleItemToOpenAPI(item))
		}
		days = append(days, openapi.TripScheduleItemsDayListItem{TripDayId: day.TripDayID, ScheduleItems: items})
	}
	return openapi.ListTripScheduleItemsResponse{Days: days}
}

func listTripPlacesResponseToOpenAPI(result trip.ListTripPlacesResult) openapi.ListTripPlacesResponse {
	places := make([]openapi.TripPlaceSummary, 0, len(result.Places))
	for _, place := range result.Places {
		places = append(places, tripPlaceSummaryToOpenAPI(place))
	}
	return openapi.ListTripPlacesResponse{Places: places}
}

func setDayLodgingPlaceResponseToOpenAPI(result trip.SetDayLodgingPlaceResult) openapi.SetDayLodgingPlaceResponse {
	return openapi.SetDayLodgingPlaceResponse{
		Day:          tripDayToOpenAPI(result.Day),
		LodgingPlace: tripPlaceSummaryToOpenAPI(result.LodgingPlace),
	}
}

func createManualDayLodgingPlaceResponseToOpenAPI(result trip.CreateManualDayLodgingPlaceResult) openapi.SetDayLodgingPlaceResponse {
	return openapi.SetDayLodgingPlaceResponse{
		Day:          tripDayToOpenAPI(result.Day),
		LodgingPlace: tripPlaceSummaryToOpenAPI(result.LodgingPlace),
	}
}

func createManualTripPlaceResponseToOpenAPI(result trip.CreateManualTripPlaceResult) openapi.CreateManualTripPlaceResponse {
	return openapi.CreateManualTripPlaceResponse{Place: tripPlaceSummaryToOpenAPI(result.Place)}
}

func createGoogleDayLodgingPlaceResponseToOpenAPI(result place.CreateGoogleDayLodgingPlaceResult) openapi.SetDayLodgingPlaceResponse {
	return openapi.SetDayLodgingPlaceResponse{
		Day:          tripDayToOpenAPI(result.Day),
		LodgingPlace: tripPlaceSummaryToOpenAPI(result.LodgingPlace),
	}
}

func createManualScheduleItemResponseToOpenAPI(result trip.CreateManualScheduleItemResult) openapi.CreateManualScheduleItemResponse {
	return openapi.CreateManualScheduleItemResponse{
		Day:          tripDayToOpenAPI(result.Day),
		ScheduleItem: dayScheduleItemToOpenAPI(result.Item),
	}
}

func getExpenseResponseToOpenAPI(result trip.GetExpenseResult) openapi.GetExpenseResponse {
	return openapi.GetExpenseResponse{Expense: expenseToOpenAPI(result.Expense)}
}

func updateExpenseResponseToOpenAPI(result trip.UpdateExpenseResult) openapi.UpdateExpenseResponse {
	return openapi.UpdateExpenseResponse{Expense: expenseToOpenAPI(result.Expense)}
}

func createQuickExpenseResponseToOpenAPI(result trip.CreateQuickExpenseResult) openapi.CreateQuickExpenseResponse {
	return openapi.CreateQuickExpenseResponse{Expense: expenseToOpenAPI(result.Expense)}
}

func createTripExpenseResponseToOpenAPI(result trip.CreateTripExpenseResult) openapi.CreateTripExpenseResponse {
	return openapi.CreateTripExpenseResponse{Expense: expenseToOpenAPI(result.Expense)}
}

func listDayExpensesResponseToOpenAPI(result trip.ListDayExpensesResult) openapi.ListDayExpensesResponse {
	expenses := make([]openapi.DayExpenseListItem, 0, len(result.Expenses))
	for _, expense := range result.Expenses {
		expenses = append(expenses, dayExpenseListItemToOpenAPI(expense))
	}

	return openapi.ListDayExpensesResponse{Expenses: expenses}
}

func listTripExpensesResponseToOpenAPI(result trip.ListTripExpensesResult) openapi.ListTripExpensesResponse {
	tripExpenses := make([]openapi.DayExpenseListItem, 0, len(result.TripExpenses))
	for _, expense := range result.TripExpenses {
		tripExpenses = append(tripExpenses, dayExpenseListItemToOpenAPI(expense))
	}

	days := make([]openapi.TripExpenseDayListItem, 0, len(result.Days))
	for _, day := range result.Days {
		expenses := make([]openapi.DayExpenseListItem, 0, len(day.Expenses))
		for _, expense := range day.Expenses {
			expenses = append(expenses, dayExpenseListItemToOpenAPI(expense))
		}
		days = append(days, openapi.TripExpenseDayListItem{TripDayId: day.TripDayID, Expenses: expenses})
	}
	return openapi.ListTripExpensesResponse{TripExpenses: tripExpenses, Days: days}
}

func dayExpenseListItemToOpenAPI(expense trip.DayExpenseListItem) openapi.DayExpenseListItem {
	splits := make([]openapi.DayExpenseSplitListItem, 0, len(expense.Splits))
	for _, split := range expense.Splits {
		splits = append(splits, openapi.DayExpenseSplitListItem{
			SplitOrder:  split.SplitOrder,
			Participant: expenseParticipantDisplayToOpenAPI(split.Participant),
			AmountMinor: split.AmountMinor,
		})
	}
	return openapi.DayExpenseListItem{
		Id:                  expense.ID,
		AnchorType:          openapi.ExpenseAnchorType(expense.AnchorType),
		TripDayId:           expense.TripDayID,
		ScheduleItemId:      expense.ScheduleItemID,
		ExpenseDate:         dateToOpenAPI(expense.ExpenseDate),
		DisplayTitle:        expense.DisplayTitle,
		Place:               expensePlaceDisplayToOpenAPI(expense.Place),
		AmountMinor:         expense.AmountMinor,
		Currency:            openapi.SupportedCurrency(expense.Currency),
		ExpenseCategory:     openapi.ExpenseCategory(expense.ExpenseCategory),
		ExpenseKind:         openapi.ExpenseKind(expense.ExpenseKind),
		Payer:               expenseParticipantDisplayToOpenAPI(expense.Payer),
		ClientMutationId:    expense.ClientMutationID,
		SplitPolicy:         openapi.ExpenseSplitPolicy(expense.SplitPolicy),
		Splits:              splits,
		IncludeInSettlement: expense.IncludeInSettlement,
		Receipt:             expenseReceiptSummaryToOpenAPI(expense.Receipt),
		CreatedAt:           expense.CreatedAt.UTC(),
	}
}

func expenseToOpenAPI(expense trip.Expense) openapi.Expense {
	splits := make([]openapi.ExpenseSplit, 0, len(expense.Splits))
	for _, split := range expense.Splits {
		splits = append(splits, openapi.ExpenseSplit{
			Participant: expenseParticipantDisplayToOpenAPI(split.Participant),
			AmountMinor: split.AmountMinor,
		})
	}
	return openapi.Expense{
		Id:                  expense.ID,
		TripId:              expense.TripID,
		AnchorType:          openapi.ExpenseAnchorType(expense.AnchorType),
		TripDayId:           expense.TripDayID,
		ScheduleItemId:      expense.ScheduleItemID,
		ExpenseDate:         dateToOpenAPI(expense.ExpenseDate),
		Title:               expense.Title,
		DisplayTitle:        expense.DisplayTitle,
		Place:               expensePlaceDisplayToOpenAPI(expense.Place),
		AmountMinor:         expense.AmountMinor,
		Currency:            openapi.SupportedCurrency(expense.Currency),
		ExpenseCategory:     openapi.ExpenseCategory(expense.ExpenseCategory),
		ExpenseKind:         openapi.ExpenseKind(expense.ExpenseKind),
		Payer:               expenseParticipantDisplayToOpenAPI(expense.Payer),
		Memo:                expense.Memo,
		ClientMutationId:    expense.ClientMutationID,
		SplitPolicy:         openapi.ExpenseSplitPolicy(expense.SplitPolicy),
		Splits:              splits,
		IncludeInSettlement: expense.IncludeInSettlement,
		Receipt:             expenseReceiptSummaryToOpenAPI(expense.Receipt),
		CreatedAt:           expense.CreatedAt.UTC(),
	}
}

func expenseReceiptSummaryToOpenAPI(summary trip.ExpenseReceiptSummary) openapi.ExpenseReceiptSummary {
	var contentType *openapi.ReceiptImageContentType
	if summary.ContentType != nil {
		value := openapi.ReceiptImageContentType(*summary.ContentType)
		contentType = &value
	}
	var uploadedAt *time.Time
	if summary.UploadedAt != nil {
		value := summary.UploadedAt.UTC()
		uploadedAt = &value
	}
	return openapi.ExpenseReceiptSummary{
		Exists:      summary.Exists,
		ContentType: contentType,
		ByteSize:    summary.ByteSize,
		UploadedAt:  uploadedAt,
	}
}

func expenseReceiptDraftToOpenAPI(draft trip.ExpenseReceiptDraft) openapi.ExpenseReceiptDraft {
	return openapi.ExpenseReceiptDraft{
		Id:          draft.ID,
		TripId:      draft.TripID,
		CaptureMode: openapi.ReceiptCaptureMode(draft.CaptureMode),
		ImageCount:  draft.ImageCount,
		ContentType: openapi.ReceiptImageContentType(draft.ContentType),
		ByteSize:    draft.ByteSize,
		Extraction:  expenseReceiptExtractionToOpenAPI(draft.Extraction),
		ExpiresAt:   draft.ExpiresAt.UTC(),
		CreatedAt:   draft.CreatedAt.UTC(),
	}
}

func expenseReceiptExtractionToOpenAPI(extraction trip.ExpenseReceiptExtraction) openapi.ExpenseReceiptExtraction {
	lineItems := make([]openapi.ExpenseReceiptLineItemDraft, 0, len(extraction.LineItems))
	for _, item := range extraction.LineItems {
		var quantity *float32
		if item.Quantity != nil {
			value := float32(*item.Quantity)
			quantity = &value
		}
		lineItems = append(lineItems, openapi.ExpenseReceiptLineItemDraft{Name: item.Name, AmountMinor: item.AmountMinor, Quantity: quantity})
	}
	var currency *openapi.SupportedCurrency
	if extraction.Currency != nil {
		value := openapi.SupportedCurrency(*extraction.Currency)
		currency = &value
	}
	var expenseDate *openapi_types.Date
	if extraction.ExpenseDate != nil {
		value := dateToOpenAPI(*extraction.ExpenseDate)
		expenseDate = &value
	}
	var placeCandidateConfidence *openapi.ExpenseReceiptConfidence
	if extraction.PlaceCandidateConfidence != nil {
		value := openapi.ExpenseReceiptConfidence(*extraction.PlaceCandidateConfidence)
		placeCandidateConfidence = &value
	}
	return openapi.ExpenseReceiptExtraction{
		MerchantName:             extraction.MerchantName,
		MerchantAddress:          extraction.MerchantAddress,
		ExpenseTitle:             extraction.ExpenseTitle,
		ExpenseDate:              expenseDate,
		ExpenseTime:              extraction.ExpenseTime,
		Currency:                 currency,
		TotalAmountMinor:         extraction.TotalAmountMinor,
		TaxAmountMinor:           extraction.TaxAmountMinor,
		ServiceChargeMinor:       extraction.ServiceChargeMinor,
		LineItems:                lineItems,
		Confidence:               openapi.ExpenseReceiptConfidence(extraction.Confidence),
		Warnings:                 extraction.Warnings,
		PlaceCandidateName:       extraction.PlaceCandidateName,
		PlaceCandidateAddress:    extraction.PlaceCandidateAddress,
		PlaceCandidateConfidence: placeCandidateConfidence,
		PlaceCandidateWarnings:   extraction.PlaceCandidateWarnings,
	}
}

func expensePlaceDisplayToOpenAPI(place *trip.ExpensePlaceDisplay) *openapi.ExpensePlaceDisplay {
	if place == nil {
		return nil
	}
	var placeType *openapi.TripPlaceType
	if place.PlaceType != nil {
		value := openapi.TripPlaceType(*place.PlaceType)
		placeType = &value
	}
	return &openapi.ExpensePlaceDisplay{
		TripPlaceId: place.TripPlaceID,
		Name:        place.Name,
		Address:     place.Address,
		PlaceType:   placeType,
		Source:      openapi.ExpenseDisplaySource(place.Source),
	}
}

func expenseParticipantDisplayToOpenAPI(participant trip.ExpenseParticipantDisplay) openapi.ExpenseParticipantDisplay {
	return openapi.ExpenseParticipantDisplay{
		ParticipantId: participant.ParticipantID,
		DisplayName:   participant.DisplayName,
		Source:        openapi.ExpenseDisplaySource(participant.Source),
	}
}

func createGooglePlaceScheduleItemResponseToOpenAPI(result place.CreateGooglePlaceScheduleItemResult) openapi.CreateGooglePlaceScheduleItemResponse {
	return openapi.CreateGooglePlaceScheduleItemResponse{
		Day:          tripDayToOpenAPI(result.Day),
		ScheduleItem: dayScheduleItemToOpenAPI(result.Item),
	}
}

func createGooglePlaceScheduleItemsBatchResponseToOpenAPI(result place.CreateGooglePlaceScheduleItemsBatchResult) openapi.CreateGooglePlaceScheduleItemsBatchResponse {
	createdItems := make([]openapi.ScheduleItem, 0, len(result.CreatedItems))
	for _, item := range result.CreatedItems {
		createdItems = append(createdItems, dayScheduleItemToOpenAPI(item))
	}
	scheduleItems := make([]openapi.ScheduleItem, 0, len(result.ScheduleItems))
	for _, item := range result.ScheduleItems {
		scheduleItems = append(scheduleItems, dayScheduleItemToOpenAPI(item))
	}
	return openapi.CreateGooglePlaceScheduleItemsBatchResponse{
		Day:                  tripDayToOpenAPI(result.Day),
		CreatedScheduleItems: createdItems,
		ScheduleItems:        scheduleItems,
	}
}

func tripPlaceBookmarksResponseToOpenAPI(bookmarks []place.TripPlaceBookmark) openapi.ListTripPlaceBookmarksResponse {
	items := make([]openapi.TripPlaceBookmark, 0, len(bookmarks))
	for _, bookmark := range bookmarks {
		items = append(items, tripPlaceBookmarkToOpenAPI(bookmark))
	}
	return openapi.ListTripPlaceBookmarksResponse{Bookmarks: items}
}

func createGoogleTripPlaceBookmarkResponseToOpenAPI(result place.CreateGoogleTripPlaceBookmarkResult) openapi.CreateGoogleTripPlaceBookmarkResponse {
	return openapi.CreateGoogleTripPlaceBookmarkResponse{Bookmark: tripPlaceBookmarkToOpenAPI(result.Bookmark)}
}

func tripPlaceBookmarkToOpenAPI(bookmark place.TripPlaceBookmark) openapi.TripPlaceBookmark {
	return openapi.TripPlaceBookmark{
		Id:        bookmark.ID,
		TripId:    bookmark.TripID,
		Category:  openapi.TripPlaceType(bookmark.Category),
		Place:     tripPlaceSummaryToOpenAPI(bookmark.Place),
		CreatedAt: bookmark.CreatedAt.UTC(),
		UpdatedAt: bookmark.UpdatedAt.UTC(),
	}
}

func updateScheduleItemResponseToOpenAPI(result trip.UpdateScheduleItemResult) openapi.UpdateScheduleItemResponse {
	return openapi.UpdateScheduleItemResponse{ScheduleItem: dayScheduleItemToOpenAPI(result.Item)}
}

func reorderScheduleItemsResponseToOpenAPI(result trip.ReorderScheduleItemsResult) openapi.ReorderScheduleItemsResponse {
	items := make([]openapi.ScheduleItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayScheduleItemToOpenAPI(item))
	}
	return openapi.ReorderScheduleItemsResponse{
		Day:           tripDayToOpenAPI(result.Day),
		ScheduleItems: items,
	}
}

func moveScheduleItemToDayResponseToOpenAPI(result trip.MoveScheduleItemToDayResult) openapi.MoveScheduleItemToDayResponse {
	sourceItems := make([]openapi.ScheduleItem, 0, len(result.SourceItems))
	for _, item := range result.SourceItems {
		sourceItems = append(sourceItems, dayScheduleItemToOpenAPI(item))
	}
	targetItems := make([]openapi.ScheduleItem, 0, len(result.TargetItems))
	for _, item := range result.TargetItems {
		targetItems = append(targetItems, dayScheduleItemToOpenAPI(item))
	}
	return openapi.MoveScheduleItemToDayResponse{
		SourceDay:           tripDayToOpenAPI(result.SourceDay),
		SourceScheduleItems: sourceItems,
		TargetDay:           tripDayToOpenAPI(result.TargetDay),
		TargetScheduleItems: targetItems,
		MovedScheduleItem:   dayScheduleItemToOpenAPI(result.MovedItem),
	}
}

func markScheduleItemArrivedResponseToOpenAPI(result trip.MarkScheduleItemArrivedResult) openapi.MarkScheduleItemArrivedResponse {
	items := make([]openapi.ScheduleItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayScheduleItemToOpenAPI(item))
	}
	return openapi.MarkScheduleItemArrivedResponse{
		Day:           tripDayToOpenAPI(result.Day),
		ScheduleItem:  dayScheduleItemToOpenAPI(result.Item),
		ScheduleItems: items,
	}
}

func markScheduleItemSkippedResponseToOpenAPI(result trip.MarkScheduleItemSkippedResult) openapi.MarkScheduleItemSkippedResponse {
	items := make([]openapi.ScheduleItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayScheduleItemToOpenAPI(item))
	}
	return openapi.MarkScheduleItemSkippedResponse{
		Day:           tripDayToOpenAPI(result.Day),
		ScheduleItem:  dayScheduleItemToOpenAPI(result.Item),
		ScheduleItems: items,
	}
}

func restoreScheduleItemResponseToOpenAPI(result trip.RestoreScheduleItemResult) openapi.RestoreScheduleItemResponse {
	items := make([]openapi.ScheduleItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayScheduleItemToOpenAPI(item))
	}
	return openapi.RestoreScheduleItemResponse{
		Day:           tripDayToOpenAPI(result.Day),
		ScheduleItem:  dayScheduleItemToOpenAPI(result.Item),
		ScheduleItems: items,
	}
}

func routePreviewResponseToOpenAPI(result route.PreviewResult) openapi.RoutePreviewResponse {
	return openapi.RoutePreviewResponse{
		ScheduleItemId: result.ItemID,
		Mode:           openapi.RoutePreviewMode(result.Mode),
		Summary:        routePreviewSummaryToOpenAPI(result.Summary),
		Map:            routePreviewMapToOpenAPI(result.Map),
		GeneratedAt:    result.GeneratedAt.UTC(),
	}
}

func routePreviewSummaryToOpenAPI(summary route.PreviewSummary) openapi.RoutePreviewSummary {
	return openapi.RoutePreviewSummary{
		DurationSeconds: summary.DurationSeconds,
		DistanceMeters:  summary.DistanceMeters,
		SummaryText:     summary.SummaryText,
		TransferCount:   summary.TransferCount,
	}
}

func routePreviewMapToOpenAPI(routeMap *route.PreviewMap) *openapi.RoutePreviewMap {
	if routeMap == nil {
		return nil
	}
	return &openapi.RoutePreviewMap{
		EncodedPolyline: routeMap.EncodedPolyline,
		Origin:          geoPointToOpenAPI(routeMap.Origin),
		Destination:     geoPointToOpenAPI(routeMap.Destination),
		Bounds: openapi.GeoBounds{
			Northeast: geoPointToOpenAPI(routeMap.Bounds.Northeast),
			Southwest: geoPointToOpenAPI(routeMap.Bounds.Southwest),
		},
	}
}

func geoPointToOpenAPI(point route.GeoPoint) openapi.GeoPoint {
	return openapi.GeoPoint{Latitude: point.Latitude, Longitude: point.Longitude}
}

func searchDestinationsResponseToOpenAPI(results []place.DestinationSearchResult) openapi.SearchDestinationsResponse {
	items := make([]openapi.DestinationSearchResult, 0, len(results))
	for _, result := range results {
		items = append(items, openapi.DestinationSearchResult{
			CityName:        result.CityName,
			CountryName:     result.CountryName,
			CountryCode:     result.CountryCode,
			DisplayName:     result.DisplayName,
			Latitude:        result.Latitude,
			Longitude:       result.Longitude,
			RadiusMeters:    result.RadiusMeters,
			Provider:        openapi.DestinationProvider(result.Provider),
			ProviderPlaceId: result.ProviderPlaceID,
		})
	}
	return openapi.SearchDestinationsResponse{Results: items}
}

func searchGooglePlacesResponseToOpenAPI(results []place.SearchResult) openapi.SearchGooglePlacesResponse {
	items := make([]openapi.GooglePlaceSearchResult, 0, len(results))
	for _, result := range results {
		item := openapi.GooglePlaceSearchResult{
			GooglePlaceId:    result.GooglePlaceID,
			DisplayName:      result.DisplayName,
			FormattedAddress: result.FormattedAddress,
			PrimaryType:      result.PrimaryType,
			PlaceType:        openapi.TripPlaceType(result.PlaceType),
			Latitude:         result.Latitude,
			Longitude:        result.Longitude,
			Rating:           result.Rating,
			UserRatingCount:  result.UserRatingCount,
			OpenNow:          result.OpenNow,
		}
		if result.PrimaryTypeDisplayName != "" {
			item.PrimaryTypeDisplayName = &result.PrimaryTypeDisplayName
		}
		if result.GoogleMapsURI != "" {
			item.GoogleMapsUri = &result.GoogleMapsURI
		}
		if result.Photo != nil {
			item.Photo = searchPhotoToOpenAPI(*result.Photo)
		}
		items = append(items, item)
	}
	return openapi.SearchGooglePlacesResponse{Results: items}
}

func searchPhotoToOpenAPI(photo place.SearchResultPhoto) *openapi.GooglePlaceSearchPhoto {
	token := photo.Token
	if token == "" {
		token = photo.Name
	}
	if token == "" {
		return nil
	}
	mapped := openapi.GooglePlaceSearchPhoto{
		Token:              token,
		AuthorAttributions: make([]openapi.GooglePlacePhotoAttribution, 0, len(photo.AuthorAttributions)),
	}
	if photo.WidthPx > 0 {
		mapped.WidthPx = &photo.WidthPx
	}
	if photo.HeightPx > 0 {
		mapped.HeightPx = &photo.HeightPx
	}
	for _, attribution := range photo.AuthorAttributions {
		item := openapi.GooglePlacePhotoAttribution{DisplayName: attribution.DisplayName}
		if attribution.URI != "" {
			item.Uri = &attribution.URI
		}
		if attribution.PhotoURI != "" {
			item.PhotoUri = &attribution.PhotoURI
		}
		mapped.AuthorAttributions = append(mapped.AuthorAttributions, item)
	}
	return &mapped
}

func googlePlaceDetailsResponseToOpenAPI(result place.GooglePlaceDescription) openapi.GooglePlaceDetailsResponse {
	mapped := openapi.GooglePlaceDetailsResponse{GooglePlaceId: result.GooglePlaceID}
	if result.DisplayName != "" {
		mapped.DisplayName = &result.DisplayName
	}
	if result.FormattedAddress != "" {
		mapped.FormattedAddress = &result.FormattedAddress
	}
	if result.Description != "" {
		mapped.Description = &result.Description
	}
	return mapped
}

func dayScheduleItemToOpenAPI(item trip.ScheduleItem) openapi.ScheduleItem {
	itemType := openapi.ScheduleItemType(item.ItemType)
	if itemType == "" {
		itemType = openapi.Place
	}
	return openapi.ScheduleItem{
		Id:            item.ID,
		ItemOrder:     item.ItemOrder,
		Version:       item.Version,
		ItemType:      itemType,
		IsLodging:     item.IsLodging,
		StartTime:     item.StartTime,
		EndTime:       item.EndTime,
		ArrivedAt:     optionalTimeToOpenAPI(item.ArrivedAt),
		SkippedAt:     optionalTimeToOpenAPI(item.SkippedAt),
		Place:         tripPlaceSummaryToOpenAPI(item.Place),
		PlaceSchedule: placeScheduleItemDetailsToOpenAPI(item.PlaceSchedule),
	}
}

func placeScheduleItemDetailsToOpenAPI(details *trip.PlaceScheduleItemDetails) *openapi.PlaceScheduleItemDetails {
	if details == nil {
		return nil
	}
	return &openapi.PlaceScheduleItemDetails{Title: details.Title, Memo: details.Memo}
}

func optionalTimeToOpenAPI(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	mapped := value.UTC()
	return &mapped
}

func tripPlaceSummaryToOpenAPI(place trip.TripPlaceSummary) openapi.TripPlaceSummary {
	return openapi.TripPlaceSummary{
		Id:            place.ID,
		Name:          place.Name,
		PlaceType:     openapi.TripPlaceType(place.PlaceType),
		Address:       place.Address,
		RoutablePlace: routablePlaceToOpenAPI(place.RoutablePlace),
	}
}

func routablePlaceToOpenAPI(place *trip.RoutablePlace) *openapi.RoutablePlace {
	if place == nil {
		return nil
	}
	return &openapi.RoutablePlace{
		Provider:      openapi.RoutablePlaceProviderGoogle,
		GooglePlaceId: place.GooglePlaceID,
		Latitude:      place.Latitude,
		Longitude:     place.Longitude,
	}
}

func optionalTripPlaceSummaryToOpenAPI(place *trip.TripPlaceSummary) *openapi.TripPlaceSummary {
	if place == nil {
		return nil
	}
	mapped := tripPlaceSummaryToOpenAPI(*place)
	return &mapped
}

func tripDayToOpenAPI(day trip.TripDay) openapi.TripDay {
	return openapi.TripDay{
		Id:           day.ID,
		Date:         dateToOpenAPI(day.Date),
		DayOrder:     day.DayOrder,
		LodgingPlace: optionalTripPlaceSummaryToOpenAPI(day.LodgingPlace),
	}
}

func tripToOpenAPI(value trip.Trip) openapi.Trip {
	return openapi.Trip{
		Id:                value.ID,
		Name:              value.Name,
		StartDate:         dateToOpenAPI(value.StartDate),
		EndDate:           dateToOpenAPI(value.EndDate),
		DefaultCurrency:   openapi.SupportedCurrency(value.DefaultCurrency),
		DefaultTravelMode: openapi.TripDefaultTravelMode(value.DefaultTravelMode),
		CreatedBy:         value.CreatedBy,
		CreatedAt:         value.CreatedAt,
		UpdatedAt:         value.UpdatedAt,
		EventContext:      tripEventContextToOpenAPI(value.EventContext),
		Destinations:      tripDestinationsToOpenAPI(value.Destinations),
	}
}

func tripEventContextToOpenAPI(value *trip.TripEventContext) *openapi.TripEventContext {
	if value == nil {
		return nil
	}
	return &openapi.TripEventContext{
		EventId:           value.EventID,
		MeetingId:         value.MeetingID,
		MeetingName:       value.MeetingName,
		MeetingVisibility: openapi.MeetingVisibility(value.MeetingVisibility),
	}
}

func tripDestinationsToOpenAPI(values []trip.TripDestination) []openapi.TripDestination {
	items := make([]openapi.TripDestination, 0, len(values))
	for _, value := range values {
		items = append(items, openapi.TripDestination{
			Id:              value.ID,
			TripId:          value.TripID,
			CityName:        value.CityName,
			CountryName:     value.CountryName,
			CountryCode:     value.CountryCode,
			DisplayName:     value.DisplayName,
			Latitude:        value.Latitude,
			Longitude:       value.Longitude,
			RadiusMeters:    value.RadiusMeters,
			Provider:        openapi.DestinationProvider(value.Provider),
			ProviderPlaceId: value.ProviderPlaceID,
			SortOrder:       value.SortOrder,
		})
	}
	return items
}

func tripDaysToOpenAPI(days []trip.TripDay) []openapi.TripDay {
	items := make([]openapi.TripDay, 0, len(days))
	for _, day := range days {
		items = append(items, tripDayToOpenAPI(day))
	}
	return items
}

func dateFromOpenAPI(value openapi_types.Date) string {
	if value.Time.IsZero() {
		return ""
	}
	return value.Time.Format("2006-01-02")
}

func optionalDateFromOpenAPI(value *openapi_types.Date) *string {
	if value == nil {
		return nil
	}
	date := dateFromOpenAPI(*value)
	return &date
}

func optionalCurrencyFromOpenAPI(value *openapi.SupportedCurrency) *string {
	if value == nil {
		return nil
	}
	currency := string(*value)
	return &currency
}

func optionalExpenseCategoryFromOpenAPI(value *openapi.ExpenseCategory) *string {
	if value == nil {
		return nil
	}
	category := string(*value)
	return &category
}

func tripDefaultTravelModeFromOpenAPI(value *openapi.TripDefaultTravelMode) string {
	if value == nil {
		return ""
	}
	return string(*value)
}

func optionalTripDefaultTravelModeFromOpenAPI(value *openapi.TripDefaultTravelMode) *string {
	if value == nil {
		return nil
	}
	mode := string(*value)
	return &mode
}

func optionalPlaceTypeFromOpenAPI(value *openapi.TripPlaceType) *string {
	if value == nil {
		return nil
	}
	placeType := string(*value)
	return &placeType
}

func dateToOpenAPI(value string) openapi_types.Date {
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return openapi_types.Date{}
	}
	return openapi_types.Date{Time: parsed}
}

func optionalString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}
