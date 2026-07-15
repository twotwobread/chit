import type { FlightDetail, UpdateTripFlightRequest } from '@i-um/api-contract';

import { type FlightCreateFormValues, validateFlightCreateRequest } from './create-form';

export type FlightEditFormValues = FlightCreateFormValues;

export function flightDetailToEditFormValues(flight: FlightDetail): FlightEditFormValues {
  return {
    displayTitle: flight.displayTitle,
    flightNumber: flight.flightNumber ?? '',
    departureAirportText: flight.departure.airportText,
    departureAirportCode: flight.departure.airportCode ?? '',
    departureLocalDate: flight.departure.localDate,
    departureLocalTime: flight.departure.localTime,
    departureTimeZone: flight.departure.timeZone,
    arrivalAirportText: flight.arrival.airportText,
    arrivalAirportCode: flight.arrival.airportCode ?? '',
    arrivalLocalDate: flight.arrival.localDate,
    arrivalLocalTime: flight.arrival.localTime,
    arrivalTimeZone: flight.arrival.timeZone,
  };
}

export function buildFlightUpdateRequest(form: FlightEditFormValues): UpdateTripFlightRequest {
  return {
    displayTitle: form.displayTitle,
    flightNumber: form.flightNumber.trim() ? form.flightNumber : null,
    departure: {
      airportText: form.departureAirportText,
      airportCode: form.departureAirportCode.trim() ? form.departureAirportCode : null,
      localDate: form.departureLocalDate,
      localTime: form.departureLocalTime,
      timeZone: form.departureTimeZone,
    },
    arrival: {
      airportText: form.arrivalAirportText,
      airportCode: form.arrivalAirportCode.trim() ? form.arrivalAirportCode : null,
      localDate: form.arrivalLocalDate,
      localTime: form.arrivalLocalTime,
      timeZone: form.arrivalTimeZone,
    },
  };
}

export function validateFlightUpdateRequest(request: UpdateTripFlightRequest): string | null {
  return validateFlightCreateRequest({ ...request, passengerParticipantIds: ['passenger-validation-placeholder'] });
}
