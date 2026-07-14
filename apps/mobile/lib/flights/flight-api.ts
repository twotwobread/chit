import {
  FlightsService,
  OpenAPI,
  type CreateTripFlightRequest,
  type CreateTripFlightResponse,
  type GetTripFlightResponse,
  type ListTripFlightsResponse,
  type OpenMyFlightBoardingPassResponse,
  type UploadMyFlightBoardingPassResponse,
  type UpsertMyFlightPersonalDetailRequest,
  type UpsertMyFlightPersonalDetailResponse,
} from '@i-um/api-contract';

import { runAuthenticatedRequest } from '../auth/client';

export async function listTripFlights(tripId: string): Promise<ListTripFlightsResponse> {
  return runAuthenticatedRequest(() => FlightsService.listTripFlights(tripId));
}

export async function createTripFlight(
  tripId: string,
  request: CreateTripFlightRequest,
): Promise<CreateTripFlightResponse> {
  return runAuthenticatedRequest(() => FlightsService.createTripFlight(tripId, request));
}

export async function getTripFlight(tripId: string, flightId: string): Promise<GetTripFlightResponse> {
  return runAuthenticatedRequest(() => FlightsService.getTripFlight(tripId, flightId));
}

export async function upsertMyFlightPersonalDetail(
  tripId: string,
  flightId: string,
  request: UpsertMyFlightPersonalDetailRequest,
): Promise<UpsertMyFlightPersonalDetailResponse> {
  return runAuthenticatedRequest(() => FlightsService.upsertMyFlightPersonalDetail(tripId, flightId, request));
}

export async function openMyFlightBoardingPass(
  tripId: string,
  flightId: string,
): Promise<OpenMyFlightBoardingPassResponse> {
  return runAuthenticatedRequest(() => FlightsService.openMyFlightBoardingPass(tripId, flightId));
}

export class FlightUploadError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'FlightUploadError';
    this.status = status;
  }
}

export async function uploadMyFlightBoardingPassBinary({
  contentType,
  flightId,
  tripId,
  uri,
}: {
  tripId: string;
  flightId: string;
  uri: string;
  contentType: string;
}): Promise<UploadMyFlightBoardingPassResponse> {
  return runAuthenticatedRequest(async () => {
    const token = typeof OpenAPI.TOKEN === 'string' ? OpenAPI.TOKEN : undefined;
    if (!token) {
      throw new FlightUploadError(401, 'missing access token');
    }
    const blob = await (await fetch(uri)).blob();
    const response = await fetch(
      `${OpenAPI.BASE}/trips/${encodeURIComponent(tripId)}/flights/${encodeURIComponent(flightId)}/my-detail/boarding-pass`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': contentType,
        },
        body: blob,
      },
    );
    if (!response.ok) {
      throw new FlightUploadError(response.status, await response.text().catch(() => 'upload failed'));
    }
    return (await response.json()) as UploadMyFlightBoardingPassResponse;
  });
}

export async function deleteMyFlightBoardingPass(tripId: string, flightId: string): Promise<void> {
  return runAuthenticatedRequest(() => FlightsService.deleteMyFlightBoardingPass(tripId, flightId));
}
