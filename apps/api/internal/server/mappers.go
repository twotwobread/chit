package server

import (
	"strings"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/twotwobread/i-um/apps/api/internal/auth"
	"github.com/twotwobread/i-um/apps/api/internal/openapi"
	"github.com/twotwobread/i-um/apps/api/internal/place"
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

func listTripsResponseToOpenAPI(trips []trip.ListItem) openapi.ListTripsResponse {
	items := make([]openapi.TripListItem, 0, len(trips))
	for _, item := range trips {
		items = append(items, openapi.TripListItem{
			Id:               item.ID,
			Name:             item.Name,
			StartDate:        dateToOpenAPI(item.StartDate),
			EndDate:          dateToOpenAPI(item.EndDate),
			DefaultCurrency:  openapi.SupportedCurrency(item.DefaultCurrency),
			JoinedAt:         item.JoinedAt,
			CreatedAt:        item.CreatedAt,
			MyRole:           openapi.TripParticipantRole(item.MyRole),
			ParticipantCount: item.ParticipantCount,
		})
	}
	return openapi.ListTripsResponse{Trips: items}
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

func listTripParticipantsResponseToOpenAPI(participants []trip.ParticipantListItem) openapi.ListTripParticipantsResponse {
	items := make([]openapi.TripParticipantListItem, 0, len(participants))
	for _, participant := range participants {
		items = append(items, openapi.TripParticipantListItem{
			ParticipantId: participant.ParticipantID,
			DisplayName:   participant.DisplayName,
			Role:          openapi.TripParticipantRole(participant.Role),
			JoinedAt:      participant.JoinedAt,
		})
	}
	return openapi.ListTripParticipantsResponse{Participants: items}
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

func getDayItineraryResponseToOpenAPI(result trip.GetDayItineraryResult) openapi.GetDayItineraryResponse {
	items := make([]openapi.DayItineraryItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayItineraryItemToOpenAPI(item))
	}
	return openapi.GetDayItineraryResponse{
		Day:   tripDayToOpenAPI(result.Day),
		Items: items,
	}
}

func setDayLodgingPlaceResponseToOpenAPI(result trip.SetDayLodgingPlaceResult) openapi.SetDayLodgingPlaceResponse {
	return openapi.SetDayLodgingPlaceResponse{
		Day:          tripDayToOpenAPI(result.Day),
		LodgingPlace: tripPlaceSummaryToOpenAPI(result.LodgingPlace),
	}
}

func createManualDayItineraryItemResponseToOpenAPI(result trip.CreateManualDayItineraryItemResult) openapi.CreateManualDayItineraryItemResponse {
	return openapi.CreateManualDayItineraryItemResponse{
		Day:  tripDayToOpenAPI(result.Day),
		Item: dayItineraryItemToOpenAPI(result.Item),
	}
}

func createQuickExpenseResponseToOpenAPI(result trip.CreateQuickExpenseResult) openapi.CreateQuickExpenseResponse {
	return openapi.CreateQuickExpenseResponse{Expense: expenseToOpenAPI(result.Expense)}
}

func expenseToOpenAPI(expense trip.Expense) openapi.Expense {
	splits := make([]openapi.ExpenseSplit, 0, len(expense.Splits))
	for _, split := range expense.Splits {
		splits = append(splits, openapi.ExpenseSplit{
			ParticipantId: split.ParticipantID,
			DisplayName:   split.DisplayName,
			AmountMinor:   split.AmountMinor,
		})
	}
	return openapi.Expense{
		Id:                 expense.ID,
		TripId:             expense.TripID,
		ScheduledDate:      dateToOpenAPI(expense.ScheduledDate),
		ItineraryItemId:    expense.ItineraryItemID,
		TripPlaceId:        expense.TripPlaceID,
		Place:              expensePlaceSnapshotToOpenAPI(expense.Place),
		AmountMinor:        expense.AmountMinor,
		Currency:           openapi.SupportedCurrency(expense.Currency),
		PayerParticipantId: expense.PayerParticipantID,
		PayerDisplayName:   expense.PayerDisplayName,
		Splits:             splits,
		CreatedAt:          expense.CreatedAt.UTC(),
	}
}

func expensePlaceSnapshotToOpenAPI(place trip.ExpensePlaceSnapshot) openapi.ExpensePlaceSnapshot {
	return openapi.ExpensePlaceSnapshot{
		Name:      place.Name,
		Address:   place.Address,
		PlaceType: openapi.TripPlaceType(place.PlaceType),
	}
}

func createGooglePlaceDayItineraryItemResponseToOpenAPI(result place.CreateGooglePlaceDayItineraryItemResult) openapi.CreateGooglePlaceDayItineraryItemResponse {
	return openapi.CreateGooglePlaceDayItineraryItemResponse{
		Day:  tripDayToOpenAPI(result.Day),
		Item: dayItineraryItemToOpenAPI(result.Item),
	}
}

func updateDayItineraryItemResponseToOpenAPI(result trip.UpdateDayItineraryItemResult) openapi.UpdateDayItineraryItemResponse {
	return openapi.UpdateDayItineraryItemResponse{Item: dayItineraryItemToOpenAPI(result.Item)}
}

func reorderDayItineraryItemsResponseToOpenAPI(result trip.ReorderDayItineraryItemsResult) openapi.ReorderDayItineraryItemsResponse {
	items := make([]openapi.DayItineraryItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayItineraryItemToOpenAPI(item))
	}
	return openapi.ReorderDayItineraryItemsResponse{
		Day:   tripDayToOpenAPI(result.Day),
		Items: items,
	}
}

func markDayItineraryItemArrivedResponseToOpenAPI(result trip.MarkDayItineraryItemArrivedResult) openapi.MarkDayItineraryItemArrivedResponse {
	items := make([]openapi.DayItineraryItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayItineraryItemToOpenAPI(item))
	}
	return openapi.MarkDayItineraryItemArrivedResponse{
		Day:   tripDayToOpenAPI(result.Day),
		Item:  dayItineraryItemToOpenAPI(result.Item),
		Items: items,
	}
}

func markDayItineraryItemSkippedResponseToOpenAPI(result trip.MarkDayItineraryItemSkippedResult) openapi.MarkDayItineraryItemSkippedResponse {
	items := make([]openapi.DayItineraryItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayItineraryItemToOpenAPI(item))
	}
	return openapi.MarkDayItineraryItemSkippedResponse{
		Day:   tripDayToOpenAPI(result.Day),
		Item:  dayItineraryItemToOpenAPI(result.Item),
		Items: items,
	}
}

func restoreDayItineraryItemResponseToOpenAPI(result trip.RestoreDayItineraryItemResult) openapi.RestoreDayItineraryItemResponse {
	items := make([]openapi.DayItineraryItem, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, dayItineraryItemToOpenAPI(item))
	}
	return openapi.RestoreDayItineraryItemResponse{
		Day:   tripDayToOpenAPI(result.Day),
		Item:  dayItineraryItemToOpenAPI(result.Item),
		Items: items,
	}
}

func searchGooglePlacesResponseToOpenAPI(results []place.SearchResult) openapi.SearchGooglePlacesResponse {
	items := make([]openapi.GooglePlaceSearchResult, 0, len(results))
	for _, result := range results {
		items = append(items, openapi.GooglePlaceSearchResult{
			GooglePlaceId:    result.GooglePlaceID,
			DisplayName:      result.DisplayName,
			FormattedAddress: result.FormattedAddress,
			PrimaryType:      result.PrimaryType,
		})
	}
	return openapi.SearchGooglePlacesResponse{Results: items}
}

func dayItineraryItemToOpenAPI(item trip.DayItineraryItem) openapi.DayItineraryItem {
	return openapi.DayItineraryItem{
		Id:        item.ID,
		ItemOrder: item.ItemOrder,
		Version:   item.Version,
		IsLodging: item.IsLodging,
		ArrivedAt: optionalTimeToOpenAPI(item.ArrivedAt),
		SkippedAt: optionalTimeToOpenAPI(item.SkippedAt),
		Place:     tripPlaceSummaryToOpenAPI(item.Place),
	}
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
		Id:        place.ID,
		Name:      place.Name,
		PlaceType: openapi.TripPlaceType(place.PlaceType),
		Address:   place.Address,
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
		Date:         dateToOpenAPI(day.Date),
		DayOrder:     day.DayOrder,
		LodgingPlace: optionalTripPlaceSummaryToOpenAPI(day.LodgingPlace),
	}
}

func tripToOpenAPI(value trip.Trip) openapi.Trip {
	return openapi.Trip{
		Id:              value.ID,
		Name:            value.Name,
		StartDate:       dateToOpenAPI(value.StartDate),
		EndDate:         dateToOpenAPI(value.EndDate),
		DefaultCurrency: openapi.SupportedCurrency(value.DefaultCurrency),
		CreatedBy:       value.CreatedBy,
		CreatedAt:       value.CreatedAt,
		UpdatedAt:       value.UpdatedAt,
	}
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
