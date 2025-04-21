#!/bin/bash
set -e

echo "Compiling migration script..."
rustc -L dependency=./target/release/deps \
      --extern diesel=./target/release/deps/libdiesel-*.rlib \
      --extern dotenvy=./target/release/deps/libdotenvy-*.rlib \
      migrate_users.rs -o migrate_users

echo "Running migration..."
./migrate_users

echo "Backing up users.txt to users.txt.bak..."
cp users.txt users.txt.bak

echo "Migration completed successfully!" 