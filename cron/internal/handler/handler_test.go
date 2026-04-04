package handler

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestHandlerTimeoutReturnsFailurePayload(t *testing.T) {
	run := func(ctx context.Context) (any, error) {
		<-ctx.Done()
		return nil, ctx.Err()
	}

	response, err := New("test", 10*time.Millisecond, run)(context.Background(), Event{Job: "test"})
	if err != nil {
		t.Fatalf("expected nil lambda error, got %v", err)
	}
	if response.OK {
		t.Fatalf("expected failed response on timeout")
	}
	if response.Error == "" {
		t.Fatalf("expected timeout error message")
	}
}

func TestHandlerSuccessResponse(t *testing.T) {
	run := func(context.Context) (any, error) {
		return map[string]int{"inserted": 1}, nil
	}

	response, err := New("test", time.Second, run)(context.Background(), Event{Job: "test"})
	if err != nil {
		t.Fatalf("expected nil lambda error, got %v", err)
	}
	if !response.OK {
		t.Fatalf("expected success response")
	}
}

func TestHandlerSwallowsRegularErrors(t *testing.T) {
	run := func(context.Context) (any, error) {
		return nil, errors.New("boom")
	}

	response, err := New("test", time.Second, run)(context.Background(), Event{Job: "test"})
	if err != nil {
		t.Fatalf("expected nil lambda error, got %v", err)
	}
	if response.OK {
		t.Fatalf("expected failed response")
	}
	if response.Error != "boom" {
		t.Fatalf("unexpected error text: %s", response.Error)
	}
}
