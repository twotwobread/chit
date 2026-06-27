package server

import (
	"html/template"
	"net/http"
	"net/url"
	"strings"
	"unicode"

	"github.com/go-chi/chi/v5"
)

const defaultAppStoreURL = "https://apps.apple.com/app/i-um"
const defaultPlayStoreURL = "https://play.google.com/store/apps/details?id=com.twotwobread.ium"
const defaultInviteAppScheme = "ium"

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
    a, button { display: block; box-sizing: border-box; width: 100%; margin-top: 12px; padding: 14px 16px; border-radius: 12px; text-align: center; text-decoration: none; font: inherit; font-weight: 700; cursor: pointer; }
    button { border: 0; }
    .primary { background: #098563; color: white; }
    .secondary { border: 1px solid #098563; background: white; color: #098563; }
    .help { margin-top: 24px; padding-top: 20px; border-top: 1px solid #ece3d7; }
    .link { margin: 8px 0 12px; padding: 12px; border-radius: 10px; background: #f8f5ef; font-size: 13px; color: #1f2a24; word-break: break-all; user-select: all; }
    .token { margin-top: 16px; font-size: 12px; color: #7a857f; word-break: break-all; }
    .status { min-height: 20px; margin-top: 8px; font-size: 13px; color: #098563; }
  </style>
</head>
<body>
  <main>
    <section>
      <h1>이음 앱에서 초대 링크를 열어주세요.</h1>
      <p>앱이 없다면 먼저 설치한 뒤, 이 초대 링크를 다시 열어주세요.</p>
      <a class="secondary" href="{{.AppOpenURL}}">앱에서 열기</a>
      {{if .ShowIOS}}<a class="primary" href="{{.AppStoreURL}}">App Store에서 설치하기</a>{{end}}
      {{if .ShowAndroid}}<a class="primary" href="{{.PlayStoreURL}}">Google Play에서 설치하기</a>{{end}}
      {{if .ShowBoth}}
        <a class="primary" href="{{.AppStoreURL}}">App Store에서 설치하기</a>
        <a class="secondary" href="{{.PlayStoreURL}}">Google Play에서 설치하기</a>
      {{end}}
      <div class="help">
        <p>앱이 설치되어 있는데 열리지 않으면 앱에서 열기 또는 초대 링크 복사를 사용해주세요.</p>
        <p id="invite-link" class="link">{{.InviteURL}}</p>
        <button class="secondary" type="button" onclick="copyInviteLink()">초대 링크 복사</button>
        <p id="copy-status" class="status" aria-live="polite"></p>
        <p class="token">초대 token: {{.Token}}</p>
      </div>
    </section>
  </main>
  <script>
    async function copyInviteLink() {
      var link = document.getElementById('invite-link').textContent.trim();
      var status = document.getElementById('copy-status');
      if (!navigator.clipboard) {
        status.textContent = '복사가 안 되면 링크를 길게 눌러 직접 복사해주세요.';
        return;
      }
      try {
        await navigator.clipboard.writeText(link);
        status.textContent = '초대 링크를 복사했어요. 앱 설치 후 다시 열어주세요.';
      } catch (error) {
        status.textContent = '복사가 안 되면 링크를 길게 눌러 직접 복사해주세요.';
      }
    }
  </script>
</body>
</html>`))

type inviteFallbackPage struct {
	Token        string
	InviteURL    string
	AppOpenURL   template.URL
	AppStoreURL  template.URL
	PlayStoreURL template.URL
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
		InviteURL:    s.canonicalInviteURL(r, token),
		AppOpenURL:   s.inviteAppOpenURL(token),
		AppStoreURL:  template.URL(firstNonEmpty(s.appStoreURL, defaultAppStoreURL)),
		PlayStoreURL: template.URL(firstNonEmpty(s.playStoreURL, defaultPlayStoreURL)),
		ShowIOS:      platform == "ios",
		ShowAndroid:  platform == "android",
		ShowBoth:     platform == "unknown",
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = inviteFallbackTemplate.Execute(w, page)
}

func (s apiServer) canonicalInviteURL(r *http.Request, token string) string {
	baseURL := firstNonEmpty(s.inviteBaseURL, inviteRequestBaseURL(r))
	return strings.TrimRight(baseURL, "/") + "/invite/" + url.PathEscape(token)
}

func (s apiServer) inviteAppOpenURL(token string) template.URL {
	scheme := normalizedInviteAppScheme(s.inviteAppScheme)
	return template.URL(scheme + "://invite/" + url.PathEscape(token))
}

func inviteRequestBaseURL(r *http.Request) string {
	protocol := firstForwardedValue(firstNonEmpty(r.Header.Get("X-Forwarded-Proto"), r.URL.Scheme))
	protocol = strings.ToLower(strings.TrimSpace(protocol))
	if protocol != "https" && protocol != "http" {
		if r.TLS != nil {
			protocol = "https"
		} else {
			protocol = "http"
		}
	}

	host := firstForwardedValue(firstNonEmpty(r.Header.Get("X-Forwarded-Host"), r.Host))
	if host == "" {
		host = "localhost"
	}
	return protocol + "://" + host
}

func firstForwardedValue(value string) string {
	beforeComma, _, _ := strings.Cut(value, ",")
	return strings.TrimSpace(beforeComma)
}

func normalizedInviteAppScheme(value string) string {
	scheme := strings.TrimSpace(value)
	scheme = strings.TrimSuffix(scheme, "://")
	scheme = strings.TrimSuffix(scheme, ":")
	if scheme == "" {
		return defaultInviteAppScheme
	}
	for _, r := range scheme {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '+' || r == '-' || r == '.' {
			continue
		}
		return defaultInviteAppScheme
	}
	return scheme
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
