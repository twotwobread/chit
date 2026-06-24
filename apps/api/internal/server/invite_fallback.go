package server

import (
	"html/template"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

const defaultAppStoreURL = "https://apps.apple.com/app/i-um"
const defaultPlayStoreURL = "https://play.google.com/store/apps/details?id=com.twotwobread.ium"

var inviteFallbackTemplate = template.Must(template.New("invite-fallback").Parse(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>이음 초대 링크</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8f5ef; color: #1f2a24; }
    main { max-width: 520px; margin: 0 auto; padding: 48px 20px; }
    section { background: #fff; border: 1px solid #ece3d7; border-radius: 20px; padding: 28px; box-shadow: 0 8px 24px rgba(31, 42, 36, 0.08); }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { margin: 0 0 20px; line-height: 1.6; color: #526159; }
    a { display: block; margin-top: 12px; padding: 14px 16px; border-radius: 12px; text-align: center; text-decoration: none; font-weight: 700; }
    .primary { background: #098563; color: white; }
    .secondary { border: 1px solid #098563; color: #098563; }
    .token { margin-top: 20px; font-size: 12px; color: #7a857f; word-break: break-all; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>이음 앱에서 초대 링크를 열어주세요.</h1>
      <p>앱이 설치되어 있지 않다면 먼저 설치한 뒤, 받은 초대 링크를 다시 열어주세요.</p>
      {{if .ShowIOS}}<a class="primary" href="{{.AppStoreURL}}">App Store에서 설치하기</a>{{end}}
      {{if .ShowAndroid}}<a class="primary" href="{{.PlayStoreURL}}">Google Play에서 설치하기</a>{{end}}
      {{if .ShowBoth}}
        <a class="primary" href="{{.AppStoreURL}}">App Store에서 설치하기</a>
        <a class="secondary" href="{{.PlayStoreURL}}">Google Play에서 설치하기</a>
      {{end}}
      <p class="token">초대 링크: /invite/{{.Token}}</p>
    </section>
  </main>
</body>
</html>`))

type inviteFallbackPage struct {
	Token        string
	AppStoreURL  string
	PlayStoreURL string
	ShowIOS      bool
	ShowAndroid  bool
	ShowBoth     bool
}

func (s apiServer) InviteFallback(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(chi.URLParam(r, "token"))
	if token == "" {
		http.NotFound(w, r)
		return
	}

	platform := inviteFallbackPlatform(r.UserAgent())
	page := inviteFallbackPage{
		Token:        token,
		AppStoreURL:  firstNonEmpty(s.appStoreURL, defaultAppStoreURL),
		PlayStoreURL: firstNonEmpty(s.playStoreURL, defaultPlayStoreURL),
		ShowIOS:      platform == "ios",
		ShowAndroid:  platform == "android",
		ShowBoth:     platform == "unknown",
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = inviteFallbackTemplate.Execute(w, page)
}

func inviteFallbackPlatform(userAgent string) string {
	value := strings.ToLower(userAgent)
	if strings.Contains(value, "iphone") || strings.Contains(value, "ipad") || strings.Contains(value, "ipod") {
		return "ios"
	}
	if strings.Contains(value, "android") {
		return "android"
	}
	return "unknown"
}
