# VALORANT版 Riot Developer Portal申請文面

## Product name

YUNAMATCH for VALORANT

## Product URL

`https://yunamatch.com/valorant-preview`

## Product description

YUNAMATCH for VALORANT is an unofficial Japanese LFG and teammate discovery service. It helps players find suitable teammates using Riot rank, preferred roles, game modes, available play times, voice-chat preferences, and self-described play style.

The product is designed for finding people to play VALORANT with. It is not a dating service and does not promote in-person meetings. Players can create a profile, browse compatible players, send a like or teammate request, match by mutual interest, and communicate through an in-service chat with reporting and blocking controls.

## Player data and opt-in

We will not display player-specific Riot data unless that player has explicitly opted in through Riot Sign On. Before linking, the user is shown which data will become visible. Account linking can be revoked at any time, and Riot-derived data is hidden after unlinking.

Without Riot account linking, users may use the service with self-described play preferences, but their profile will not be marked as Riot-verified and will not display Riot-derived statistics.

## Requested access

- Production API key
- Riot Sign On client
- Player identity required to associate the consenting user with their profile
- Current competitive rank and permitted match/stat data for the consenting user

The final scope will be limited to the minimum fields necessary for teammate discovery.

## Approved use case

LFG tools requiring player opt-in.

## User flow

1. User opens the service and can review the purpose and safety rules.
2. User chooses whether to connect a Riot account.
3. Before OAuth, the service explains that linked Riot data will become visible on the user's own public LFG profile.
4. User completes Riot Sign On and grants access.
5. User selects preferred roles, modes, available times, voice-chat preference, and play style.
6. The service recommends other opted-in players based on compatible preferences.
7. User sends a like or teammate request.
8. Mutual interest or request approval creates a match and enables in-service chat.
9. Users can report, block, cancel requests, unmatch, unlink Riot, or delete their service account.

## Safety and integrity

The product will not provide:

- unofficial MMR or ELO calculations;
- opponent scouting before a match;
- data about players who have not opted in;
- real-time coaching or behavioral instructions during a match;
- overlays that modify or obstruct the game;
- game-client modification, automation, cheats, betting, or gambling;
- account trading or requests for Riot login credentials.

The product includes reporting, blocking, request cancellation, account deletion, and moderation of reported content. Private chats are not generally accessible to administrators; only specifically reported messages are reviewed when necessary for safety and enforcement.

## Monetization

The initial release will be free. Monetization will not be enabled until the product is registered and its status permits monetization under Riot's policies. Any future monetization will retain a free tier and will be limited to transformative service features, appropriate advertising, or other methods allowed by Riot policy.

## Branding and disclaimer

The service uses its own name, logo, user interface, and original visual assets. It does not use Riot or VALORANT logos as the service brand and does not claim affiliation, sponsorship, or endorsement.

The following disclaimer is shown conspicuously:

> YUNAMATCH for VALORANT is an unofficial fan-made LFG service. Riot Games does not endorse or sponsor this project.

## Privacy

Riot-derived data is used only for the purposes explained to the user. API credentials and RSO client secrets are held only on the server. Users can unlink their Riot account and request deletion of their YUNAMATCH account and associated data.

## Review prototype

The review page provides an interactive representation of the complete user flow, including opt-in, profile creation, discovery, matching, safety controls, and unlinking explanations:

`https://yunamatch.com/valorant-preview`
