Hello new undergrad! Hopefully this document can give you some insight and
onboarding to the BioGames project. If you haven't already, you should read the
paper included in this repository. It should give you an overview of everything.
The Rust backend uses axum for the web framework and diesel as an ORM.

A couple notes on the database schema: the `started_at` and `finished_at` fields
on the `games` table are unused in the UI, and the `finished_at` field isn't
ever assigned to. I encourage you to implement assigning to it when a game is
completed (or quit). Same goes for the `max_score` field. A requirement was to
"display perfect scores first" on the leaderboard, so I thought it would be
necessary to track the maximum possible score for a game, but it turned out that
it was as simple as ordering by score and then by time. The `points` field on
the `challenges` table could also probably be removed. At first, we had the
score computed as a function of accuracy and time, similarly to what's described
in the Discussion section of the paper. However, Professor Ozcan wanted it to
just be a function of accuracy, so now `points` is simply `|score - guess|`.

One thing we wanted to add but didn't get around to was rotating and flipping
images to further increase the perceived diversity of the dataset. I tried doing
this with Rust's `image` crate, but ran into some pretty bad performance issues
(on the order of 10 seconds to load, transform, and send an image). Maybe you
can take another crack at it.

I ran the Postgres database for development using Docker. I encourage you too as
well. Word of warning about leaving the ports open, though: if you're connected
to an Ethernet jack in UCLA housing, your computer very well might be on the
public internet. I learned that the hard way when someone logged into my
Postgres Docker container and started mining cryptocurrency. I didn't set a
secure password, though, so just make sure to do that, or have it only listen on
the loopback interface, or set a firewall, or all three, and you should be fine.

The raw images are huge. I resized and re-encoded them to WebP and will leave
them on the portable SSD as well.

Hopefully this and the code comments provides you with ample information to
familiarize yourself with the project. If you have any questions, you can reach
out to me at mark (dot) gross (two thousand and one) (at) gmail.com.

# Scoring System

The game uses a confusion matrix to score user guesses:

| Guess/GT | 0 | 1 | 2 | 3 |
|----------|---|---|---|---|
| 0        | 5 |-2 |-3 |-5 |
| 1        |-1 | 5 |-2 |-3 |
| 2        |-2 |-1 | 5 |-1 |
| 3        |-4 |-2 |-1 | 5 |

- Correct guess (diagonal): 5 points
- Minor errors: -1 point
- Moderate errors: -2 points
- Severe errors: -3 to -5 points

This scoring system rewards accuracy and penalizes more severely for larger mistakes.
