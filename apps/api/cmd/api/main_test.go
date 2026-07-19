package main

import (
	"os/exec"
	"strings"
	"testing"
)

func TestGCSRuntimeConfigUsesCanonicalValuesForBothStores(t *testing.T) {
	t.Setenv("GCS_BUCKET", "shared-bucket")
	t.Setenv("GCS_SIGNING_ACCESS_ID", "signer@example.iam.gserviceaccount.com")
	t.Setenv("GCS_SIGNING_PRIVATE_KEY", "private-key")
	t.Setenv("BOARDING_PASS_GCS_BUCKET", "")
	t.Setenv("BOARDING_PASS_GCS_SIGNING_ACCESS_ID", "")
	t.Setenv("BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY", "")
	t.Setenv("EXPENSE_RECEIPT_GCS_BUCKET", "")
	t.Setenv("EXPENSE_RECEIPT_GCS_SIGNING_ACCESS_ID", "")
	t.Setenv("EXPENSE_RECEIPT_GCS_SIGNING_PRIVATE_KEY", "")

	boardingPass := boardingPassGCSConfigFromEnv()
	receipt := expenseReceiptGCSConfigFromEnv()

	for name, config := range map[string]gcsObjectStoreEnvConfig{"boarding pass": boardingPass, "expense receipt": receipt} {
		if config.Bucket != "shared-bucket" || config.SigningAccessID != "signer@example.iam.gserviceaccount.com" || config.SigningPrivateKey != "private-key" {
			t.Fatalf("%s config did not use canonical GCS env: %#v", name, config)
		}
	}
}

func TestGCSRuntimeConfigAllowsFeatureSpecificOverride(t *testing.T) {
	t.Setenv("GCS_BUCKET", "shared-bucket")
	t.Setenv("GCS_SIGNING_ACCESS_ID", "shared-signer@example.iam.gserviceaccount.com")
	t.Setenv("GCS_SIGNING_PRIVATE_KEY", "shared-private-key")
	t.Setenv("BOARDING_PASS_GCS_BUCKET", "boarding-bucket")
	t.Setenv("BOARDING_PASS_GCS_SIGNING_ACCESS_ID", "boarding-signer@example.iam.gserviceaccount.com")
	t.Setenv("BOARDING_PASS_GCS_SIGNING_PRIVATE_KEY", "boarding-private-key")
	t.Setenv("EXPENSE_RECEIPT_GCS_BUCKET", "receipt-bucket")
	t.Setenv("EXPENSE_RECEIPT_GCS_SIGNING_ACCESS_ID", "receipt-signer@example.iam.gserviceaccount.com")
	t.Setenv("EXPENSE_RECEIPT_GCS_SIGNING_PRIVATE_KEY", "receipt-private-key")

	boardingPass := boardingPassGCSConfigFromEnv()
	receipt := expenseReceiptGCSConfigFromEnv()

	if boardingPass.Bucket != "boarding-bucket" || boardingPass.SigningAccessID != "boarding-signer@example.iam.gserviceaccount.com" || boardingPass.SigningPrivateKey != "boarding-private-key" {
		t.Fatalf("boarding pass override not applied: %#v", boardingPass)
	}
	if receipt.Bucket != "receipt-bucket" || receipt.SigningAccessID != "receipt-signer@example.iam.gserviceaccount.com" || receipt.SigningPrivateKey != "receipt-private-key" {
		t.Fatalf("expense receipt override not applied: %#v", receipt)
	}
}

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
