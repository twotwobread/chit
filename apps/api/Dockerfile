# syntax=docker/dockerfile:1

FROM golang:1.22.5-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . ./
RUN CGO_ENABLED=0 GOOS=linux go build -buildvcs=false -o /out/api ./cmd/api

FROM alpine:3.20

RUN apk add --no-cache ca-certificates \
  && addgroup -S app \
  && adduser -S -G app app

WORKDIR /app
COPY --from=build /out/api /app/api

ENV PORT=8080
EXPOSE 8080

USER app
ENTRYPOINT ["/app/api"]
