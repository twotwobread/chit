package place

import "strings"

const (
	TripPlaceTypeSights    = "sights"
	TripPlaceTypeFood      = "food"
	TripPlaceTypeLodging   = "lodging"
	TripPlaceTypeCafe      = "cafe"
	TripPlaceTypeShopping  = "shopping"
	TripPlaceTypeTransport = "transport"
	TripPlaceTypeEtc       = "etc"
)

var googlePlaceTypeMap = map[string]string{
	"accounting":              TripPlaceTypeEtc,
	"airport":                 TripPlaceTypeTransport,
	"amusement_park":          TripPlaceTypeSights,
	"aquarium":                TripPlaceTypeSights,
	"art_gallery":             TripPlaceTypeSights,
	"atm":                     TripPlaceTypeEtc,
	"bakery":                  TripPlaceTypeFood,
	"bank":                    TripPlaceTypeEtc,
	"bar":                     TripPlaceTypeFood,
	"beauty_salon":            TripPlaceTypeEtc,
	"bed_and_breakfast":       TripPlaceTypeLodging,
	"bicycle_store":           TripPlaceTypeShopping,
	"book_store":              TripPlaceTypeShopping,
	"bowling_alley":           TripPlaceTypeSights,
	"bus_station":             TripPlaceTypeTransport,
	"bus_stop":                TripPlaceTypeTransport,
	"cafe":                    TripPlaceTypeCafe,
	"campground":              TripPlaceTypeLodging,
	"car_dealer":              TripPlaceTypeEtc,
	"car_rental":              TripPlaceTypeTransport,
	"car_repair":              TripPlaceTypeEtc,
	"car_wash":                TripPlaceTypeEtc,
	"casino":                  TripPlaceTypeSights,
	"cemetery":                TripPlaceTypeEtc,
	"church":                  TripPlaceTypeSights,
	"city_hall":               TripPlaceTypeEtc,
	"clothing_store":          TripPlaceTypeShopping,
	"coffee_shop":             TripPlaceTypeCafe,
	"convenience_store":       TripPlaceTypeShopping,
	"courthouse":              TripPlaceTypeEtc,
	"dentist":                 TripPlaceTypeEtc,
	"department_store":        TripPlaceTypeShopping,
	"doctor":                  TripPlaceTypeEtc,
	"drugstore":               TripPlaceTypeShopping,
	"electrician":             TripPlaceTypeEtc,
	"electronics_store":       TripPlaceTypeShopping,
	"embassy":                 TripPlaceTypeEtc,
	"ferry_terminal":          TripPlaceTypeTransport,
	"finance":                 TripPlaceTypeEtc,
	"fire_station":            TripPlaceTypeEtc,
	"florist":                 TripPlaceTypeShopping,
	"food":                    TripPlaceTypeFood,
	"funeral_home":            TripPlaceTypeEtc,
	"furniture_store":         TripPlaceTypeShopping,
	"gas_station":             TripPlaceTypeTransport,
	"general_contractor":      TripPlaceTypeEtc,
	"grocery_or_supermarket":  TripPlaceTypeShopping,
	"guest_house":             TripPlaceTypeLodging,
	"gym":                     TripPlaceTypeEtc,
	"hair_care":               TripPlaceTypeEtc,
	"hardware_store":          TripPlaceTypeShopping,
	"health":                  TripPlaceTypeEtc,
	"hindu_temple":            TripPlaceTypeSights,
	"historical_landmark":     TripPlaceTypeSights,
	"home_goods_store":        TripPlaceTypeShopping,
	"hospital":                TripPlaceTypeEtc,
	"hostel":                  TripPlaceTypeLodging,
	"hotel":                   TripPlaceTypeLodging,
	"insurance_agency":        TripPlaceTypeEtc,
	"jewelry_store":           TripPlaceTypeShopping,
	"landmark":                TripPlaceTypeSights,
	"laundry":                 TripPlaceTypeEtc,
	"lawyer":                  TripPlaceTypeEtc,
	"library":                 TripPlaceTypeSights,
	"light_rail_station":      TripPlaceTypeTransport,
	"liquor_store":            TripPlaceTypeShopping,
	"local_government_office": TripPlaceTypeEtc,
	"lodging":                 TripPlaceTypeLodging,
	"meal_delivery":           TripPlaceTypeFood,
	"meal_takeaway":           TripPlaceTypeFood,
	"mosque":                  TripPlaceTypeSights,
	"motel":                   TripPlaceTypeLodging,
	"movie_rental":            TripPlaceTypeEtc,
	"movie_theater":           TripPlaceTypeSights,
	"moving_company":          TripPlaceTypeEtc,
	"museum":                  TripPlaceTypeSights,
	"night_club":              TripPlaceTypeFood,
	"painter":                 TripPlaceTypeEtc,
	"park":                    TripPlaceTypeSights,
	"parking":                 TripPlaceTypeTransport,
	"pet_store":               TripPlaceTypeShopping,
	"pharmacy":                TripPlaceTypeShopping,
	"physiotherapist":         TripPlaceTypeEtc,
	"place_of_worship":        TripPlaceTypeSights,
	"plumber":                 TripPlaceTypeEtc,
	"police":                  TripPlaceTypeEtc,
	"post_office":             TripPlaceTypeEtc,
	"primary_school":          TripPlaceTypeEtc,
	"real_estate_agency":      TripPlaceTypeEtc,
	"resort_hotel":            TripPlaceTypeLodging,
	"restaurant":              TripPlaceTypeFood,
	"roofing_contractor":      TripPlaceTypeEtc,
	"rv_park":                 TripPlaceTypeLodging,
	"school":                  TripPlaceTypeEtc,
	"secondary_school":        TripPlaceTypeEtc,
	"shoe_store":              TripPlaceTypeShopping,
	"shopping_mall":           TripPlaceTypeShopping,
	"spa":                     TripPlaceTypeEtc,
	"stadium":                 TripPlaceTypeSights,
	"storage":                 TripPlaceTypeEtc,
	"store":                   TripPlaceTypeShopping,
	"subway_station":          TripPlaceTypeTransport,
	"supermarket":             TripPlaceTypeShopping,
	"synagogue":               TripPlaceTypeSights,
	"taxi_stand":              TripPlaceTypeTransport,
	"tourist_attraction":      TripPlaceTypeSights,
	"train_station":           TripPlaceTypeTransport,
	"transit_station":         TripPlaceTypeTransport,
	"travel_agency":           TripPlaceTypeEtc,
	"university":              TripPlaceTypeEtc,
	"veterinary_care":         TripPlaceTypeEtc,
	"zoo":                     TripPlaceTypeSights,
}

func MapProviderPlaceType(provider string, primaryType string, rawTypes []string) string {
	mapping := providerTypeMap(strings.TrimSpace(provider))
	if len(mapping) == 0 {
		return TripPlaceTypeEtc
	}
	if mapped, ok := mapping[normalizeProviderType(primaryType)]; ok {
		return mapped
	}
	for _, value := range rawTypes {
		if mapped, ok := mapping[normalizeProviderType(value)]; ok {
			return mapped
		}
	}
	return TripPlaceTypeEtc
}

func providerTypeMap(provider string) map[string]string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case DestinationProviderGoogle:
		return googlePlaceTypeMap
	default:
		return nil
	}
}

func normalizeProviderType(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
