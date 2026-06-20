package main

import (
	"log"
	"net/http"
	"os"

	"github.com/twotwobread/i-um/apps/api/internal/server"
)

func main() {
	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}

	log.Printf("i-um API listening on %s", addr)
	if err := http.ListenAndServe(addr, server.NewRouter()); err != nil {
		log.Fatal(err)
	}
}
