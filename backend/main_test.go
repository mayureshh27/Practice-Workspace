package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestProblemPreservesLearningFlowFields(t *testing.T) {
	body, err := json.Marshal(Problem{
		ProblemText: "problem copy",
		HowItWorks:  "how copy",
		Syntax:      "syntax copy",
		Solve:       "solve copy",
	})
	if err != nil {
		t.Fatal(err)
	}

	for _, want := range []string{
		`"problemText":"problem copy"`,
		`"howItWorks":"how copy"`,
		`"syntax":"syntax copy"`,
		`"solve":"solve copy"`,
	} {
		if !strings.Contains(string(body), want) {
			t.Fatalf("marshaled problem missing %s in %s", want, body)
		}
	}
}
