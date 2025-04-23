#!/bin/bash

# export PGPASSWORD=24LOveyxyzboxfog729
# for path in cores-webp/*/*; do
#     score=$(echo "$path" | cut -d/ -f 2)
#     query="insert into her2_cores (file_name, score) values (:'v1', :'v2');"
#     echo "$query" | psql \
#         -h 127.0.0.1 \
#         biogames postgres \
#         -v v1="$path" -v v2="$score"
# done

export PGPASSWORD=innovate123
for path in /home/biogames/biogames-repo/Data_WebP/*/*; do
    score=$(echo "$path" | cut -d/ -f 6)
    query="insert into her2_cores (file_name, score) values (:'v1', :'v2');"
    echo $score
    echo "$query" | psql \
        -h 127.0.0.1 \
        biogames postgres \
        -v v1="$path" -v v2="$score"
done
