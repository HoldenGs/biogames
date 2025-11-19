#!/bin/bash

# Set feature flags to allow specific domains
export BYPASS_EMAIL_VALIDATION=false
export ALLOWED_EMAIL_DOMAINS="@ucla.edu,@mednet.ucla.edu,@mail.huji.ac.il,@hadassah.org.il"

echo "Running API with specific allowed email domains"
echo "ALLOWED_EMAIL_DOMAINS=$ALLOWED_EMAIL_DOMAINS"

# Run the API server
./target/release/biogames-api 