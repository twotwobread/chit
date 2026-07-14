package main

import (
	"os/exec"
	"strings"
	"testing"
)

func TestAPIBinaryEmbedsTimezoneDatabaseForCloudRun(t *testing.T) {
	command := exec.Command("go", "list", "-deps", ".")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("go list cmd/api deps: %v\n%s", err, output)
	}

	deps := "\n" + string(output) + "\n"
	if !strings.Contains(deps, "\ntime/tzdata\n") {
		t.Fatalf("cmd/api must embed time/tzdata so deployed runtimes without OS zoneinfo accept IANA zones such as Asia/Seoul")
	}
}
