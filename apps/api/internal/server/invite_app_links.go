package server

import (
	"net/http"
	"strings"
)

const defaultAndroidPackageName = "com.twotwobread.ium"

const invitePathPattern = "/invite/*"

type appleAppSiteAssociationResponse struct {
	Applinks appleAppLinks `json:"applinks"`
}

type appleAppLinks struct {
	Apps    []string                        `json:"apps"`
	Details []appleAppSiteAssociationDetail `json:"details"`
}

type appleAppSiteAssociationDetail struct {
	AppID string   `json:"appID"`
	Paths []string `json:"paths"`
}

type androidAssetLinkStatement struct {
	Relation []string               `json:"relation"`
	Target   androidAssetLinkTarget `json:"target"`
}

type androidAssetLinkTarget struct {
	Namespace              string   `json:"namespace"`
	PackageName            string   `json:"package_name"`
	SHA256CertFingerprints []string `json:"sha256_cert_fingerprints"`
}

func (s apiServer) InviteAppleAppSiteAssociation(w http.ResponseWriter, r *http.Request) {
	appIDs := nonEmptyStrings(s.inviteIOSAppIDs)
	if len(appIDs) == 0 {
		http.NotFound(w, r)
		return
	}

	details := make([]appleAppSiteAssociationDetail, 0, len(appIDs))
	for _, appID := range appIDs {
		details = append(details, appleAppSiteAssociationDetail{
			AppID: appID,
			Paths: []string{invitePathPattern},
		})
	}

	writeJSON(w, http.StatusOK, appleAppSiteAssociationResponse{
		Applinks: appleAppLinks{
			Apps:    []string{},
			Details: details,
		},
	})
}

func (s apiServer) InviteAndroidAssetLinks(w http.ResponseWriter, r *http.Request) {
	fingerprints := nonEmptyStrings(s.inviteAndroidSHA256CertFingerprints)
	if len(fingerprints) == 0 {
		http.NotFound(w, r)
		return
	}

	packageName := firstNonEmpty(s.inviteAndroidPackageName, defaultAndroidPackageName)
	writeJSON(w, http.StatusOK, []androidAssetLinkStatement{
		{
			Relation: []string{"delegate_permission/common.handle_all_urls"},
			Target: androidAssetLinkTarget{
				Namespace:              "android_app",
				PackageName:            packageName,
				SHA256CertFingerprints: fingerprints,
			},
		},
	})
}

func nonEmptyStrings(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
