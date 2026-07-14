package place

import (
	"context"
	"strings"
)

type GooglePlaceSnapshotRefreshTarget struct {
	ID            string
	GooglePlaceID string
}

type GooglePlaceSnapshotUpdate struct {
	ID        string
	Snapshot  GooglePlaceDetails
	PlaceType string
}

type GooglePlaceSnapshotRefreshStore interface {
	ListGooglePlaceSnapshotRefreshTargets(ctx context.Context, limit int) ([]GooglePlaceSnapshotRefreshTarget, error)
	UpdateGooglePlaceSnapshot(ctx context.Context, update GooglePlaceSnapshotUpdate) error
}

type GooglePlaceSnapshotRefreshOptions struct {
	Apply bool
	Limit int
}

type GooglePlaceSnapshotRefreshSummary struct {
	Targets   int
	Refreshed int
	Updated   int
	Failed    int
	DryRun    bool
}

func RefreshGooglePlaceSnapshots(ctx context.Context, store GooglePlaceSnapshotRefreshStore, provider Provider, options GooglePlaceSnapshotRefreshOptions) (GooglePlaceSnapshotRefreshSummary, error) {
	summary := GooglePlaceSnapshotRefreshSummary{DryRun: !options.Apply}
	if store == nil || provider == nil {
		return summary, ErrProviderUnavailable
	}
	targets, err := store.ListGooglePlaceSnapshotRefreshTargets(ctx, options.Limit)
	if err != nil {
		return summary, err
	}
	summary.Targets = len(targets)

	for _, target := range targets {
		googlePlaceID := strings.TrimSpace(target.GooglePlaceID)
		if strings.TrimSpace(target.ID) == "" || googlePlaceID == "" {
			summary.Failed++
			continue
		}
		details, err := provider.Details(ctx, ProviderDetailsInput{GooglePlaceID: googlePlaceID})
		if err != nil {
			summary.Failed++
			continue
		}
		snapshot, err := buildGooglePlaceSnapshot(googlePlaceID, details)
		if err != nil {
			summary.Failed++
			continue
		}
		summary.Refreshed++
		if !options.Apply {
			continue
		}
		update := GooglePlaceSnapshotUpdate{
			ID:        strings.TrimSpace(target.ID),
			Snapshot:  snapshot,
			PlaceType: MapProviderPlaceType(DestinationProviderGoogle, snapshot.PrimaryType, snapshot.Types),
		}
		if err := store.UpdateGooglePlaceSnapshot(ctx, update); err != nil {
			summary.Failed++
			continue
		}
		summary.Updated++
	}

	return summary, nil
}
