package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRunCodeRejectsProjectSubmit(t *testing.T) {
	store = Store{Problems: []Problem{{
		ID:           "exercise-1-3",
		ExerciseMode: "project",
		Verifier:     "manual",
		TestCode:     `func main(){ panic("should not execute") }`,
	}}}

	req := httptest.NewRequest(http.MethodPost, "/api/run", strings.NewReader(`{"problemId":"exercise-1-3","code":"package main","mode":"submit"}`))
	rr := httptest.NewRecorder()

	runCode(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusBadRequest)
	}
	if !strings.Contains(rr.Body.String(), "judgeable local-test") {
		t.Fatalf("response %q does not explain the submit restriction", rr.Body.String())
	}
}
