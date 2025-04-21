#!/bin/bash

# Set feature flags for testing
export BYPASS_EMAIL_VALIDATION=true
# Alternatively, to test with specific domains:
# export BYPASS_EMAIL_VALIDATION=false
# export ALLOWED_EMAIL_DOMAINS="@ucla.edu,@mednet.ucla.edu,@test.com"

echo "Running API with testing feature flags enabled"
echo "BYPASS_EMAIL_VALIDATION=$BYPASS_EMAIL_VALIDATION"

# Run the API server
./target/release/biogames-api 