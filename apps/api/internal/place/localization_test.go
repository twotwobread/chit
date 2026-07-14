package place

import (
	"context"
	"errors"
	"testing"
)

func TestRefreshGooglePlaceSnapshotsDryRunDoesNotUpdate(t *testing.T) {
	store := &fakeGooglePlaceSnapshotStore{
		targets: []GooglePlaceSnapshotRefreshTarget{{ID: "place-1", GooglePlaceID: "google-1"}},
	}
	provider := &fakeGooglePlaceSnapshotProvider{
		detailsByID: map[string]GooglePlaceDetails{
			"google-1": validLocalizedGooglePlaceDetails("google-1", "도톤보리", "일본 오사카부 오사카시 주오구 도톤보리"),
		},
	}

	summary, err := RefreshGooglePlaceSnapshots(context.Background(), store, provider, GooglePlaceSnapshotRefreshOptions{Apply: false})
	if err != nil {
		t.Fatalf("RefreshGooglePlaceSnapshots returned error: %v", err)
	}

	if summary.Targets != 1 || summary.Refreshed != 1 || summary.Updated != 0 || summary.Failed != 0 || !summary.DryRun {
		t.Fatalf("unexpected dry-run summary %#v", summary)
	}
	if len(store.updates) != 0 {
		t.Fatalf("expected dry-run not to update, got %#v", store.updates)
	}
	if len(provider.detailRequests) != 1 || provider.detailRequests[0].GooglePlaceID != "google-1" {
		t.Fatalf("expected provider details request for target, got %#v", provider.detailRequests)
	}
}

func TestRefreshGooglePlaceSnapshotsApplyUpdatesLocalizedSnapshot(t *testing.T) {
	store := &fakeGooglePlaceSnapshotStore{
		targets: []GooglePlaceSnapshotRefreshTarget{{ID: "place-1", GooglePlaceID: "google-1"}},
	}
	provider := &fakeGooglePlaceSnapshotProvider{
		detailsByID: map[string]GooglePlaceDetails{
			"google-1": validLocalizedGooglePlaceDetails("google-1", "도톤보리", "일본 오사카부 오사카시 주오구 도톤보리"),
		},
	}

	summary, err := RefreshGooglePlaceSnapshots(context.Background(), store, provider, GooglePlaceSnapshotRefreshOptions{Apply: true})
	if err != nil {
		t.Fatalf("RefreshGooglePlaceSnapshots returned error: %v", err)
	}

	if summary.Targets != 1 || summary.Refreshed != 1 || summary.Updated != 1 || summary.Failed != 0 || summary.DryRun {
		t.Fatalf("unexpected apply summary %#v", summary)
	}
	if len(store.updates) != 1 {
		t.Fatalf("expected one update, got %#v", store.updates)
	}
	update := store.updates[0]
	if update.ID != "place-1" || update.Snapshot.DisplayName != "도톤보리" || update.Snapshot.FormattedAddress != "일본 오사카부 오사카시 주오구 도톤보리" {
		t.Fatalf("unexpected update snapshot %#v", update)
	}
	if update.PlaceType != "sights" {
		t.Fatalf("expected provider type to map to sights, got %q", update.PlaceType)
	}
}

func TestRefreshGooglePlaceSnapshotsCountsProviderFailures(t *testing.T) {
	store := &fakeGooglePlaceSnapshotStore{
		targets: []GooglePlaceSnapshotRefreshTarget{{ID: "place-1", GooglePlaceID: "google-1"}},
	}
	provider := &fakeGooglePlaceSnapshotProvider{detailsErr: ErrProviderUnavailable}

	summary, err := RefreshGooglePlaceSnapshots(context.Background(), store, provider, GooglePlaceSnapshotRefreshOptions{Apply: true})
	if err != nil {
		t.Fatalf("RefreshGooglePlaceSnapshots returned error for row-level provider failure: %v", err)
	}

	if summary.Targets != 1 || summary.Refreshed != 0 || summary.Updated != 0 || summary.Failed != 1 {
		t.Fatalf("unexpected failure summary %#v", summary)
	}
	if len(store.updates) != 0 {
		t.Fatalf("expected no updates after provider failure, got %#v", store.updates)
	}
}

func validLocalizedGooglePlaceDetails(id string, name string, address string) GooglePlaceDetails {
	return GooglePlaceDetails{
		GooglePlaceID:    id,
		DisplayName:      name,
		FormattedAddress: address,
		Latitude:         34.6687,
		Longitude:        135.5013,
		PrimaryType:      "tourist_attraction",
		Types:            []string{"tourist_attraction", "point_of_interest"},
	}
}

type fakeGooglePlaceSnapshotStore struct {
	targets   []GooglePlaceSnapshotRefreshTarget
	updates   []GooglePlaceSnapshotUpdate
	listErr   error
	updateErr error
}

func (s *fakeGooglePlaceSnapshotStore) ListGooglePlaceSnapshotRefreshTargets(context.Context, int) ([]GooglePlaceSnapshotRefreshTarget, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	return append([]GooglePlaceSnapshotRefreshTarget(nil), s.targets...), nil
}

func (s *fakeGooglePlaceSnapshotStore) UpdateGooglePlaceSnapshot(_ context.Context, update GooglePlaceSnapshotUpdate) error {
	if s.updateErr != nil {
		return s.updateErr
	}
	s.updates = append(s.updates, update)
	return nil
}

type fakeGooglePlaceSnapshotProvider struct {
	detailsByID    map[string]GooglePlaceDetails
	detailsErr     error
	detailRequests []ProviderDetailsInput
}

func (p *fakeGooglePlaceSnapshotProvider) Search(context.Context, ProviderSearchInput) ([]SearchResult, error) {
	return nil, errors.New("not implemented")
}

func (p *fakeGooglePlaceSnapshotProvider) SearchDestinations(context.Context, ProviderDestinationSearchInput) ([]DestinationSearchResult, error) {
	return nil, errors.New("not implemented")
}

func (p *fakeGooglePlaceSnapshotProvider) Details(_ context.Context, input ProviderDetailsInput) (GooglePlaceDetails, error) {
	p.detailRequests = append(p.detailRequests, input)
	if p.detailsErr != nil {
		return GooglePlaceDetails{}, p.detailsErr
	}
	return p.detailsByID[input.GooglePlaceID], nil
}

func (p *fakeGooglePlaceSnapshotProvider) Description(context.Context, ProviderDescriptionInput) (GooglePlaceDescription, error) {
	return GooglePlaceDescription{}, errors.New("not implemented")
}

func (p *fakeGooglePlaceSnapshotProvider) Photo(context.Context, ProviderPhotoInput) (GooglePlacePhoto, error) {
	return GooglePlacePhoto{}, errors.New("not implemented")
}
