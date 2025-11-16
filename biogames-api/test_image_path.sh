#!/bin/bash

# Set the database URL and image base path
export DATABASE_URL="postgres://postgres:innovate123@127.0.0.1/biogames"
export IMAGE_BASE_PATH="/home/biogames/biogames-repo/Data_WebP"

echo "Testing image path access..."
echo "Database: $DATABASE_URL"
echo "Image base path: $IMAGE_BASE_PATH"

# Get a filename from the database
FILENAME=$(./psql.sh -t -c "SELECT file_name FROM her2_cores LIMIT 1;" | xargs)

if [ -z "$FILENAME" ]; then
    echo "Error: Could not retrieve a filename from the database."
    exit 1
fi

echo "Retrieved filename from database: $FILENAME"

# Check if the file exists at the original path
if [ -f "$FILENAME" ]; then
    echo "File exists at original path: $FILENAME"
else
    echo "File not found at original path, checking USB path..."
    
    # Extract just the filename without the path
    BASE_FILENAME=$(basename "$FILENAME")
    USB_PATH="$IMAGE_BASE_PATH/$BASE_FILENAME"
    
    # Check if the file exists at the USB path
    if [ -f "$USB_PATH" ]; then
        echo "Success! File found at USB path: $USB_PATH"
    else
        echo "Error: File not found at USB path: $USB_PATH"
        
        # List files in the USB directory to help with debugging
        echo "Contents of $IMAGE_BASE_PATH:"
        ls -la "$IMAGE_BASE_PATH" | head -10
    fi
fi 
