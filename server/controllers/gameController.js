import Game from "../models/gameModel.js";
import Match from "../models/matchModel.js";
import Room from "../models/roomModel.js";
import User from "../models/userModel.js";
import {
    getOrCreateUnregisteredPlayer,
    addPointsToUnregisteredPlayer,
    trackUnregisteredPlayerParticipation,
    updateUnregisteredPlayerStats
} from "../utils/unregisteredPlayerUtils.js";

// Helper: Create a BYE team object for bye matches
// Always returns a team object with letter "BYE" regardless of originalTeam
const createByeTeam = (originalTeam = null) => {
    // Always return a BYE team object with letter "BYE"
    // The originalTeam parameter is used to get player info if needed, but letter is always "BYE"
    return {
        letter: "BYE", // Always "BYE", never use originalTeam.letter
        players: originalTeam && originalTeam.players ? originalTeam.players.map((p) => ({
            userId: p.userId || null,
            name: p.name || "Bye",
            mobile: p.mobile || null,
        })) : [],
        points: originalTeam && originalTeam.totalPoints ? originalTeam.totalPoints : 0,
    };
};

// Helper: Generate match schedule based on game format
const generateMatches = (teams, gameType, roundNumber = 1) => {
    const matches = [];

    if (gameType === "round-robin") {
        // Round Robin: Every team plays every other team
        // Use balanced scheduling to ensure teams get rest between matches
        const allMatchPairs = [];
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                allMatchPairs.push({
                    teamA: teams[i],
                    teamB: teams[j],
                });
            }
        }

        // Balanced scheduling: Distribute matches so no team plays consecutively
        const scheduledMatches = [];
        const teamMatchCounts = {}; // Track how many matches each team has played

        // Helper to get team letter
        const getTeamLetter = (team) => team?.letter || team;

        // Initialize match counts for all teams
        teams.forEach(team => {
            const letter = getTeamLetter(team);
            teamMatchCounts[letter] = 0;
        });

        // Helper function to find next best match (avoids consecutive play, balances match distribution)
        const findNextMatch = (remainingPairs) => {
            if (remainingPairs.length === 0) return null;

            // If this is the first match, pick any
            if (scheduledMatches.length === 0) {
                return remainingPairs[0];
            }

            // Get teams that played in the last match (to avoid consecutive play)
            const lastMatch = scheduledMatches[scheduledMatches.length - 1];
            const lastTeamA = getTeamLetter(lastMatch.teamA);
            const lastTeamB = getTeamLetter(lastMatch.teamB);
            const lastTeams = new Set([lastTeamA, lastTeamB]);

            // Filter out matches involving teams that just played (give them rest)
            const availableMatches = remainingPairs.filter(pair => {
                const teamA = getTeamLetter(pair.teamA);
                const teamB = getTeamLetter(pair.teamB);
                return !lastTeams.has(teamA) && !lastTeams.has(teamB);
            });

            // If no matches avoid last teams, use all remaining (will happen at end)
            const candidates = availableMatches.length > 0 ? availableMatches : remainingPairs;

            // Sort by total matches played by both teams (ascending) - prioritize teams that have played fewer matches
            candidates.sort((a, b) => {
                const aTeamA = getTeamLetter(a.teamA);
                const aTeamB = getTeamLetter(a.teamB);
                const bTeamA = getTeamLetter(b.teamA);
                const bTeamB = getTeamLetter(b.teamB);

                const aTotal = (teamMatchCounts[aTeamA] || 0) + (teamMatchCounts[aTeamB] || 0);
                const bTotal = (teamMatchCounts[bTeamA] || 0) + (teamMatchCounts[bTeamB] || 0);
                return aTotal - bTotal;
            });

            return candidates[0];
        };

        // Schedule matches one by one with balanced distribution
        const remaining = [...allMatchPairs];
        while (remaining.length > 0) {
            const nextMatch = findNextMatch(remaining);
            if (!nextMatch) break;

            const teamALetter = getTeamLetter(nextMatch.teamA);
            const teamBLetter = getTeamLetter(nextMatch.teamB);

            scheduledMatches.push({
                roundNumber,
                matchNumber: scheduledMatches.length + 1,
                teamA: nextMatch.teamA,
                teamB: nextMatch.teamB,
            });

            // Update match counts for tracking
            teamMatchCounts[teamALetter] = (teamMatchCounts[teamALetter] || 0) + 1;
            teamMatchCounts[teamBLetter] = (teamMatchCounts[teamBLetter] || 0) + 1;

            // Remove from remaining pairs
            const index = remaining.findIndex(p =>
                (p.teamA === nextMatch.teamA && p.teamB === nextMatch.teamB) ||
                (p.teamA === nextMatch.teamB && p.teamB === nextMatch.teamA)
            );
            if (index !== -1) {
                remaining.splice(index, 1);
            }
        }

        matches.push(...scheduledMatches);
        console.log('🎮 [Backend] Round Robin - Balanced match schedule (teams get rest):', scheduledMatches.map(m => ({
            match: m.matchNumber,
            teamA: getTeamLetter(m.teamA),
            teamB: getTeamLetter(m.teamB),
        })));
    } else if (gameType === "quick-knockout") {
        // Quick Knockout: Sequential pairing
        for (let i = 0; i < teams.length; i += 2) {
            if (i + 1 < teams.length) {
                matches.push({
                    roundNumber,
                    matchNumber: matches.length + 1,
                    teamA: teams[i],
                    teamB: teams[i + 1],
                });
            }
        }
    } else if (gameType === "one-vs-one") {
        // 1 vs 1: Single match between two players (2 teams of 1 player each)
        if (teams.length === 2) {
            matches.push({
                roundNumber,
                matchNumber: 1,
                teamA: teams[0],
                teamB: teams[1],
                bracketType: "final",
            });
        }
    } else if (gameType === "two-vs-two") {
        // 2 vs 2: Single match between two teams of 2 players each
        if (teams.length === 2) {
            matches.push({
                roundNumber,
                matchNumber: 1,
                teamA: teams[0],
                teamB: teams[1],
                bracketType: "final",
            });
        }
    } else {
        // Pickle Format: Sequential pairing (similar to quick knockout for Round 1)
        for (let i = 0; i < teams.length; i += 2) {
            if (i + 1 < teams.length) {
                matches.push({
                    roundNumber,
                    matchNumber: matches.length + 1,
                    teamA: teams[i],
                    teamB: teams[i + 1],
                });
            }
        }
    }

    return matches;
};

// Helper: Generate next round matches based on game format and previous round results
const generateNextRoundMatches = async (game, completedRound, allMatches) => {
    const matches = [];
    const gameType = game.type;
    const nextRoundNumber = completedRound + 1;

    if (gameType === "round-robin" || gameType === "one-vs-one" || gameType === "two-vs-two") {
        // Round Robin, 1v1, and 2v2 create all matches in one round, no next rounds
        return matches;
    }

    // Get all matches from completed round
    const roundMatches = allMatches.filter(
        (m) => m.roundNumber === completedRound && m.status === "finished"
    );

    if (gameType === "pickle") {
        console.log('🎮 [Backend] generateNextRoundMatches - Pickle Format');
        console.log('🎮 [Backend] Completed Round:', completedRound);
        console.log('🎮 [Backend] Round Matches:', roundMatches.map(m => ({
            round: m.roundNumber,
            match: m.matchNumber,
            teamA: m.teamA?.letter,
            teamB: m.teamB?.letter,
            winner: m.winner,
        })));
        // Pickle Format bracket progression
        if (completedRound === 1) {
            // Round 2: Create winners and losers brackets
            const winners = [];
            const losers = [];
            const teamsThatPlayed = new Set();

            // Separate winners and losers from Round 1
            // Filter out BYE teams - they don't actually play
            roundMatches.forEach((match) => {
                // Skip BYE matches when extracting teams
                if (match.isBye) {
                    // In a bye match, only teamA is a real team, teamB is BYE
                    // TeamA automatically wins, so add it to winners
                    if (match.teamA && match.teamA.letter !== "BYE") {
                        winners.push(match.teamA);
                        teamsThatPlayed.add(match.teamA.letter);
                    }
                    return;
                }

                if (match.winner === "A") {
                    // Only add real teams (not BYE)
                    if (match.teamA && match.teamA.letter !== "BYE") {
                        winners.push(match.teamA);
                        teamsThatPlayed.add(match.teamA.letter);
                    }
                    if (match.teamB && match.teamB.letter !== "BYE") {
                        losers.push(match.teamB);
                        teamsThatPlayed.add(match.teamB.letter);
                    }
                } else {
                    // Only add real teams (not BYE)
                    if (match.teamB && match.teamB.letter !== "BYE") {
                        winners.push(match.teamB);
                        teamsThatPlayed.add(match.teamB.letter);
                    }
                    if (match.teamA && match.teamA.letter !== "BYE") {
                        losers.push(match.teamA);
                        teamsThatPlayed.add(match.teamA.letter);
                    }
                }
            });

            console.log('🎮 [Backend] Round 1 Results:', {
                winners: winners.map(w => w.letter),
                losers: losers.map(l => l.letter),
                teamsThatPlayed: Array.from(teamsThatPlayed),
                allGameTeams: game.teams.map(t => t.letter),
            });

            // Find teams that got a bye (didn't play in Round 1)
            const teamsWithBye = game.teams.filter((team) => !teamsThatPlayed.has(team.letter));
            console.log('🎮 [Backend] Teams with bye:', teamsWithBye.map(t => t.letter));

            // For Pickle Format with bye teams (e.g., 3 teams):
            // - Winners bracket: Winner plays against bye team
            // - Losers bracket: Loser gets bye (advances automatically)

            if (teamsWithBye.length > 0) {
                // There are teams that got bye - they join winners bracket
                // Winners bracket: Pair winners with bye teams
                let winnersIndex = 0;
                for (const byeTeam of teamsWithBye) {
                    // Convert byeTeam from game.teams structure to match structure
                    const byeTeamForMatch = {
                        letter: byeTeam.letter,
                        players: byeTeam.players.map((p) => ({
                            userId: p.userId || null,
                            name: p.name,
                            mobile: p.mobile || null,
                        })),
                        points: byeTeam.totalPoints || 0,
                    };

                    if (winnersIndex < winners.length) {
                        // Winner plays against bye team
                        matches.push({
                            roundNumber: nextRoundNumber,
                            matchNumber: matches.length + 1,
                            teamA: winners[winnersIndex],
                            teamB: byeTeamForMatch,
                            bracketType: "winners",
                        });
                        winnersIndex++;
                    } else {
                        // More bye teams than winners - bye team gets automatic bye
                        matches.push({
                            roundNumber: nextRoundNumber,
                            matchNumber: matches.length + 1,
                            teamA: byeTeamForMatch,
                            teamB: createByeTeam(byeTeamForMatch), // Use BYE team object instead of same team
                            bracketType: "winners",
                            isBye: true,
                        });
                    }
                }
                // If there are remaining winners after pairing with bye teams
                for (let i = winnersIndex; i < winners.length; i += 2) {
                    if (i + 1 < winners.length) {
                        matches.push({
                            roundNumber: nextRoundNumber,
                            matchNumber: matches.length + 1,
                            teamA: winners[i],
                            teamB: winners[i + 1],
                            bracketType: "winners",
                        });
                    } else {
                        matches.push({
                            roundNumber: nextRoundNumber,
                            matchNumber: matches.length + 1,
                            teamA: winners[i],
                            teamB: createByeTeam(winners[i]), // Use BYE team object instead of same team
                            bracketType: "winners",
                            isBye: true,
                        });
                    }
                }
            } else {
                // No bye teams - normal bracket progression
                // Winners Bracket: Pair winners
                if (winners.length >= 2) {
                    for (let i = 0; i < winners.length; i += 2) {
                        if (i + 1 < winners.length) {
                            matches.push({
                                roundNumber: nextRoundNumber,
                                matchNumber: matches.length + 1,
                                teamA: winners[i],
                                teamB: winners[i + 1],
                                bracketType: "winners",
                            });
                        } else {
                            matches.push({
                                roundNumber: nextRoundNumber,
                                matchNumber: matches.length + 1,
                                teamA: winners[i],
                                teamB: createByeTeam(winners[i]), // Use BYE team object instead of same team
                                bracketType: "winners",
                                isBye: true,
                            });
                        }
                    }
                } else if (winners.length === 1) {
                    matches.push({
                        roundNumber: nextRoundNumber,
                        matchNumber: 1,
                        teamA: winners[0],
                        teamB: createByeTeam(winners[0]), // Use BYE team object instead of same team
                        bracketType: "winners",
                        isBye: true,
                    });
                }
            }

            // Losers Bracket: Pair losers (losers always get bye if there are bye teams, or pair normally)
            if (losers.length >= 2) {
                for (let i = 0; i < losers.length; i += 2) {
                    if (i + 1 < losers.length) {
                        matches.push({
                            roundNumber: nextRoundNumber,
                            matchNumber: matches.length + 1,
                            teamA: losers[i],
                            teamB: losers[i + 1],
                            bracketType: "losers",
                        });
                    } else {
                        // Single loser gets bye in losers bracket
                        matches.push({
                            roundNumber: nextRoundNumber,
                            matchNumber: matches.length + 1,
                            teamA: losers[i],
                            teamB: createByeTeam(losers[i]), // Use BYE team object instead of same team
                            bracketType: "losers",
                            isBye: true,
                        });
                    }
                }
            } else if (losers.length === 1) {
                // Only one loser - they get bye (advance automatically)
                matches.push({
                    roundNumber: nextRoundNumber,
                    matchNumber: matches.length + 1,
                    teamA: losers[0],
                    teamB: createByeTeam(losers[0]), // Use BYE team object instead of same team
                    bracketType: "losers",
                    isBye: true,
                });
            }
        } else if (completedRound === 2) {
            // Round 3: Final match (winners bracket winner vs losers bracket winner)
            const winnersBracketMatches = roundMatches.filter(
                (m) => m.bracketType === "winners" && !m.isBye
            );
            const losersBracketMatches = roundMatches.filter(
                (m) => m.bracketType === "losers" && !m.isBye
            );

            let winnersWinner = null;
            let losersWinner = null;

            // Find winners bracket champion
            winnersBracketMatches.forEach((match) => {
                if (match.winner === "A") {
                    winnersWinner = match.teamA;
                } else if (match.winner === "B") {
                    winnersWinner = match.teamB;
                }
            });

            // Handle bye case - if there's a bye match, that team advances
            const winnersBye = roundMatches.find(
                (m) => m.bracketType === "winners" && m.isBye
            );
            if (winnersBye) {
                // For bye matches, the team automatically advances (they won by default)
                winnersWinner = winnersBye.teamA || winnersBye.teamB;
            }

            // Find losers bracket champion
            losersBracketMatches.forEach((match) => {
                if (match.winner === "A") {
                    losersWinner = match.teamA;
                } else if (match.winner === "B") {
                    losersWinner = match.teamB;
                }
            });

            const losersBye = roundMatches.find(
                (m) => m.bracketType === "losers" && m.isBye
            );
            if (losersBye) {
                // For bye matches, the team advances automatically
                losersWinner = losersBye.teamA || losersBye.teamB;
            }

            // Create final match
            if (winnersWinner && losersWinner) {
                matches.push({
                    roundNumber: nextRoundNumber,
                    matchNumber: 1,
                    teamA: winnersWinner,
                    teamB: losersWinner,
                    bracketType: "final",
                });
            }
        }
    } else if (gameType === "quick-knockout") {
        // Quick Knockout bracket progression
        if (completedRound === 1) {
            // Round 2: Smart seeding based on score differences
            // Team with huge score difference goes directly to finals
            // Team with smaller gap plays with bye team in Round 2

            const teamsThatPlayed = new Set();
            const matchResults = [];

            // Collect winners with their score differences
            roundMatches.forEach((match) => {
                // Skip BYE matches - they don't have real scores
                if (match.isBye) {
                    // In a bye match, only teamA is a real team
                    if (match.teamA && match.teamA.letter !== "BYE") {
                        teamsThatPlayed.add(match.teamA.letter);
                    }
                    return;
                }

                const scoreA = match.scoreA || 0;
                const scoreB = match.scoreB || 0;
                const scoreDifference = Math.abs(scoreA - scoreB);

                let winnerTeam, loserTeam;
                if (match.winner === "A") {
                    winnerTeam = match.teamA;
                    loserTeam = match.teamB;
                } else {
                    winnerTeam = match.teamB;
                    loserTeam = match.teamA;
                }

                // Only track real teams (not BYE)
                if (match.teamA && match.teamA.letter !== "BYE") {
                    teamsThatPlayed.add(match.teamA.letter);
                }
                if (match.teamB && match.teamB.letter !== "BYE") {
                    teamsThatPlayed.add(match.teamB.letter);
                }

                matchResults.push({
                    winner: winnerTeam,
                    loser: loserTeam,
                    scoreDifference: scoreDifference,
                    winnerScore: match.winner === "A" ? scoreA : scoreB,
                    loserScore: match.winner === "A" ? scoreB : scoreA,
                });
            });

            // Find teams that got byes in Round 1 (didn't play)
            const teamsWithBye = game.teams.filter((team) => !teamsThatPlayed.has(team.letter));

            console.log('🎮 [Backend] Quick Knockout Round 1 Results:', {
                matchResults: matchResults.map(m => ({
                    winner: m.winner.letter,
                    loser: m.loser.letter,
                    scoreDiff: m.scoreDifference,
                    score: `${m.winnerScore}-${m.loserScore}`,
                })),
                teamsWithBye: teamsWithBye.map(t => t.letter),
                teamsThatPlayed: Array.from(teamsThatPlayed),
            });

            // If there's a bye team (odd number of teams), use smart seeding
            if (teamsWithBye.length > 0 && matchResults.length >= 2) {
                // Sort matches by score difference (largest first = dominant wins)
                matchResults.sort((a, b) => b.scoreDifference - a.scoreDifference);

                const dominantWinner = matchResults[0].winner; // Largest score difference → goes to finals
                const closeWinner = matchResults[1].winner; // Smaller score difference → plays with bye
                const byeTeam = teamsWithBye[0];

                console.log('🎮 [Backend] Smart Seeding Applied:', {
                    dominantWinner: dominantWinner.letter,
                    dominantScoreDiff: matchResults[0].scoreDifference,
                    closeWinner: closeWinner.letter,
                    closeScoreDiff: matchResults[1].scoreDifference,
                    byeTeam: byeTeam.letter,
                });

                // Round 2: Close winner plays with bye team
                matches.push({
                    roundNumber: nextRoundNumber,
                    matchNumber: 1,
                    teamA: closeWinner,
                    teamB: byeTeam,
                    bracketType: "semifinal",
                });

                // Dominant winner goes directly to finals (will be created in Round 3)
                // Round 3 logic will identify dominant winner by checking Round 1 score differences

            } else if (teamsWithBye.length > 0 && matchResults.length === 1) {
                // Only 3 teams: One match + one bye
                // Winner plays with bye team in Round 2
                const winner = matchResults[0].winner;
                const loser = matchResults[0].loser;
                const byeTeam = teamsWithBye[0];

                matches.push({
                    roundNumber: nextRoundNumber,
                    matchNumber: 1,
                    teamA: winner,
                    teamB: byeTeam,
                    bracketType: "semifinal",
                });

                game._semifinalLoser = loser; // For bronze placement
            } else {
                // No bye teams or only 2 matches - use standard pairing
                const winners = matchResults.map(m => m.winner);
                teamsWithBye.forEach((team) => {
                    winners.push(team);
                });

                for (let i = 0; i < winners.length; i += 2) {
                    if (i + 1 < winners.length) {
                        matches.push({
                            roundNumber: nextRoundNumber,
                            matchNumber: matches.length + 1,
                            teamA: winners[i],
                            teamB: winners[i + 1],
                            bracketType: "semifinal",
                        });
                    } else {
                        matches.push({
                            roundNumber: nextRoundNumber,
                            matchNumber: matches.length + 1,
                            teamA: winners[i],
                            teamB: createByeTeam(winners[i]), // Use BYE team object instead of null
                            bracketType: "semifinal",
                            isBye: true,
                        });
                    }
                }
            }
        } else if (completedRound === 2) {
            // Round 3: Create Bronze match (losers of semifinals) and Final
            // Check if smart seeding was used (dominant winner from Round 1 goes to finals)

            const semifinals = roundMatches.filter(
                (m) => m.bracketType === "semifinal" && !m.isBye
            );

            // Check Round 1 matches to find dominant winner (if smart seeding was used)
            const round1Matches = allMatches.filter(
                (m) => m.roundNumber === 1 && m.status === "finished"
            );

            let dominantWinner = null;
            const teamsThatPlayedRound1 = new Set();
            round1Matches.forEach(m => {
                teamsThatPlayedRound1.add(m.teamA.letter);
                teamsThatPlayedRound1.add(m.teamB.letter);
            });
            const byeTeam = game.teams.find(t => !teamsThatPlayedRound1.has(t.letter));

            // If we have Round 1 matches with bye team, check for dominant winner
            // Also handle 3 teams case (1 match + 1 bye)
            if ((round1Matches.length >= 2 && byeTeam) || (round1Matches.length === 1 && byeTeam)) {
                const round1Results = round1Matches
                    .filter(match => !match.isBye) // Filter out BYE matches
                    .map(match => {
                        const scoreA = match.scoreA || 0;
                        const scoreB = match.scoreB || 0;
                        const scoreDifference = Math.abs(scoreA - scoreB);
                        const winner = match.winner === "A" ? match.teamA : match.teamB;
                        // Only include if winner is not a BYE team
                        if (winner && winner.letter !== "BYE") {
                            return { winner, scoreDifference };
                        }
                        return null;
                    })
                    .filter(result => result !== null); // Remove null results

                // Sort by score difference (largest first)
                round1Results.sort((a, b) => b.scoreDifference - a.scoreDifference);

                // If there's a significant difference, dominant winner goes to finals
                // For 3 teams (1 match), the winner automatically goes to finals
                if (round1Results.length === 1) {
                    // 3 teams case: single winner goes to finals
                    dominantWinner = round1Results[0].winner;
                    console.log('🎮 [Backend] 3 teams case - winner goes to finals:', {
                        dominantWinner: dominantWinner.letter,
                        scoreDifference: round1Results[0].scoreDifference,
                    });
                } else if (round1Results.length >= 2 && round1Results[0].scoreDifference > round1Results[1].scoreDifference) {
                    dominantWinner = round1Results[0].winner;
                    console.log('🎮 [Backend] Dominant winner found for Round 3:', {
                        dominantWinner: dominantWinner.letter,
                        scoreDifference: round1Results[0].scoreDifference,
                        otherWinner: round1Results[1].winner.letter,
                        otherScoreDifference: round1Results[1].scoreDifference,
                    });
                }
            }

            const finalWinners = [];
            const semifinalLosers = [];

            semifinals.forEach((match) => {
                // Skip BYE matches when extracting teams
                if (match.isBye) {
                    // In a bye match, only teamA is a real team, teamB is BYE
                    // TeamA automatically wins, so add it to finalWinners
                    if (match.teamA && match.teamA.letter !== "BYE") {
                        finalWinners.push(match.teamA);
                    }
                    return;
                }

                if (match.winner === "A") {
                    // Only add real teams (not BYE)
                    if (match.teamA && match.teamA.letter !== "BYE") {
                        finalWinners.push(match.teamA);
                    }
                    if (match.teamB && match.teamB.letter !== "BYE") {
                        semifinalLosers.push(match.teamB);
                    }
                } else {
                    // Only add real teams (not BYE)
                    if (match.teamB && match.teamB.letter !== "BYE") {
                        finalWinners.push(match.teamB);
                    }
                    if (match.teamA && match.teamA.letter !== "BYE") {
                        semifinalLosers.push(match.teamA);
                    }
                }
            });

            // Handle bye in semifinals (if no smart seeding)
            if (!dominantWinner) {
                const semifinalBye = roundMatches.find(
                    (m) => m.bracketType === "semifinal" && m.isBye
                );
                if (semifinalBye) {
                    finalWinners.push(semifinalBye.teamA);
                }
            }

            // If smart seeding was used, add dominant winner to final
            if (dominantWinner) {
                // Ensure dominant winner is first in the array
                finalWinners.unshift(dominantWinner);
                console.log('🎮 [Backend] Adding dominant winner to finals:', {
                    dominantWinner: dominantWinner.letter,
                    semifinalWinner: finalWinners.length > 1 ? finalWinners[1]?.letter : 'none',
                    totalFinalWinners: finalWinners.length,
                });
            }

            // Bronze Match
            // If smart seeding was used, Round 1 losers play for bronze
            if (dominantWinner && round1Matches.length >= 2) {
                const round1Losers = round1Matches
                    .filter(match => !match.isBye) // Filter out BYE matches
                    .map(match => {
                        const loser = match.winner === "A" ? match.teamB : match.teamA;
                        // Only include if loser is not a BYE team
                        return (loser && loser.letter !== "BYE") ? loser : null;
                    })
                    .filter(loser => loser !== null); // Remove null results

                // Add semifinal loser (loser of C vs E match)
                const bronzeContenders = [...round1Losers, ...semifinalLosers];

                // Remove duplicates
                const uniqueContenders = [];
                const seenLetters = new Set();
                for (const contender of bronzeContenders) {
                    if (!seenLetters.has(contender.letter)) {
                        uniqueContenders.push(contender);
                        seenLetters.add(contender.letter);
                    }
                }

                if (uniqueContenders.length >= 2) {
                    matches.push({
                        roundNumber: nextRoundNumber,
                        matchNumber: matches.length + 1,
                        teamA: uniqueContenders[0],
                        teamB: uniqueContenders[1],
                        bracketType: "bronze",
                    });
                } else if (uniqueContenders.length === 1) {
                    matches.push({
                        roundNumber: nextRoundNumber,
                        matchNumber: matches.length + 1,
                        teamA: uniqueContenders[0],
                        teamB: createByeTeam(uniqueContenders[0]), // Use BYE team object instead of null
                        bracketType: "bronze",
                        isBye: true,
                    });
                }
            } else {
                // Standard bronze logic
                if (semifinalLosers.length >= 2) {
                    matches.push({
                        roundNumber: nextRoundNumber,
                        matchNumber: matches.length + 1,
                        teamA: semifinalLosers[0],
                        teamB: semifinalLosers[1],
                        bracketType: "bronze",
                    });
                } else if (semifinalLosers.length === 1) {
                    // Only one loser, they get bronze by default
                    matches.push({
                        roundNumber: nextRoundNumber,
                        matchNumber: matches.length + 1,
                        teamA: semifinalLosers[0],
                        teamB: createByeTeam(semifinalLosers[0]), // Use BYE team object instead of null
                        bracketType: "bronze",
                        isBye: true,
                    });
                }
            }

            // Final Match
            if (finalWinners.length >= 2) {
                matches.push({
                    roundNumber: nextRoundNumber,
                    matchNumber: matches.length + 1,
                    teamA: finalWinners[0],
                    teamB: finalWinners[1],
                    bracketType: "final",
                });
            } else if (finalWinners.length === 1) {
                // Single winner gets bye to final
                matches.push({
                    roundNumber: nextRoundNumber,
                    matchNumber: matches.length + 1,
                    teamA: finalWinners[0],
                    teamB: createByeTeam(finalWinners[0]), // Use BYE team object instead of null
                    bracketType: "final",
                    isBye: true,
                });
            }
        }
    }

    console.log('🎮 [Backend] generateNextRoundMatches returning:', {
        gameType,
        completedRound,
        nextRound: completedRound + 1,
        matchCount: matches.length,
        matches: matches.map(m => ({
            round: m.roundNumber,
            match: m.matchNumber,
            teamA: m.teamA?.letter,
            teamB: m.teamB?.letter,
            bracketType: m.bracketType,
            isBye: m.isBye,
        })),
    });
    return matches;
};

// CREATE - Create a new game
const createGame = async (req, res) => {
    try {
        const { roomId, gameType, teams } = req.body;
        const userId = req.user._id;
        console.log('🎮 [Backend] createGame called:', {
            roomId,
            gameType,
            teamCount: teams?.length || 0,
            userId: userId.toString(),
        });

        // Validate required fields
        if (!roomId || !gameType || !teams) {
            return res.status(400).json({
                success: false,
                message: "Room ID, game type, and teams are required",
            });
        }

        // Validate game type
        const validGameTypes = ["pickle", "round-robin", "quick-knockout", "one-vs-one", "two-vs-two"];
        if (!validGameTypes.includes(gameType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid game type. Must be: pickle, round-robin, quick-knockout, one-vs-one, or two-vs-two",
            });
        }

        // Validate teams
        if (!Array.isArray(teams) || teams.length < 2) {
            return res.status(400).json({
                success: false,
                message: "At least 2 teams are required",
            });
        }

        // Verify room exists and user has access
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found",
            });
        }

        // Check if user is room creator or member
        const isCreator = room.createdBy.toString() === userId.toString();
        const isMember = room.members.some(
            (memberId) => memberId.toString() === userId.toString()
        );

        if (!isCreator && !isMember) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to create games in this room",
            });
        }

        // Check if there's already an active game for this room
        const existingActiveGame = await Game.findOne({
            roomId: roomId,
            status: { $in: ['pending', 'live'] }
        });

        if (existingActiveGame) {
            return res.status(400).json({
                success: false,
                message: "There is already an active game in this room. Please complete or cancel it before creating a new one.",
                existingGameId: existingActiveGame._id,
            });
        }

        // Generate matches for Round 1
        const round1Matches = generateMatches(teams, gameType, 1);
        console.log('🎮 [Backend] Generated Round 1 matches:', round1Matches.length);

        // Create game with initialized medals object
        const game = new Game({
            roomId,
            createdBy: userId,
            type: gameType,
            teams: teams,
            status: "pending",
            currentRound: 1,
            medals: {
                gold: { team: null, players: [] },
                silver: { team: null, players: [] },
                bronze: { team: null, players: [] }
            }
        });

        await game.save();
        console.log('🎮 [Backend] Game created:', {
            gameId: game._id.toString(),
            gameType: game.type,
            currentRound: game.currentRound,
        });

        // Create matches
        const createdMatches = [];
        for (const matchData of round1Matches) {
            const match = new Match({
                gameId: game._id,
                roundNumber: matchData.roundNumber,
                matchNumber: matchData.matchNumber,
                teamA: {
                    letter: matchData.teamA.letter,
                    players: matchData.teamA.players.map((p) => ({
                        userId: p.userId || null,
                        name: p.name,
                        mobile: p.mobile || null,
                    })),
                    points: matchData.teamA.totalPoints || 0,
                },
                teamB: {
                    letter: matchData.teamB.letter,
                    players: matchData.teamB.players.map((p) => ({
                        userId: p.userId || null,
                        name: p.name,
                        mobile: p.mobile || null,
                    })),
                    points: matchData.teamB.totalPoints || 0,
                },
                status: "pending",
                bracketType: matchData.bracketType || null,
                isBye: matchData.isBye || false,
            });
            await match.save();
            createdMatches.push(match._id);
        }

        // Update game with match IDs
        game.matches = createdMatches;
        game.status = "live";
        await game.save();

        // Add game to room history
        room.history.push(game._id);
        await room.save();

        // Track unregistered players in this game
        const unregisteredPlayersSet = new Set();
        for (const team of teams) {
            for (const player of team.players) {
                if (!player.userId && player.mobile) {
                    const normalizedMobile = player.mobile.replace(/[\s\-+()]/g, '').replace(/^91/, '').slice(-10);
                    unregisteredPlayersSet.add(JSON.stringify({ mobile: normalizedMobile, name: player.name }));
                }
            }
        }

        // Create/update UnregisteredPlayer records and track participation
        for (const playerStr of unregisteredPlayersSet) {
            const player = JSON.parse(playerStr);
            await getOrCreateUnregisteredPlayer(player.mobile, player.name);
            await trackUnregisteredPlayerParticipation(player.mobile, {
                gameId: game._id,
                roomId: roomId
            });
        }

        // Populate game with matches
        const populatedGame = await Game.findById(game._id)
            .populate("matches")
            .populate("createdBy", "username displayName")
            .populate("roomId", "name code");

        res.status(201).json({
            success: true,
            message: "Game created successfully",
            game: populatedGame,
        });
    } catch (error) {
        console.error("Error creating game:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// READ - Get game by ID
const getGameById = async (req, res) => {
    try {
        const { gameId } = req.params;

        const game = await Game.findById(gameId)
            .populate("matches")
            .populate("createdBy", "username displayName")
            .populate("roomId", "name code");

        if (!game) {
            return res.status(404).json({
                success: false,
                message: "Game not found",
            });
        }

        res.status(200).json({
            success: true,
            game,
        });
    } catch (error) {
        console.error("Error getting game:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// UPDATE - Submit match result
const submitMatchResult = async (req, res) => {
    try {
        const { matchId } = req.params;
        const { scoreA, scoreB } = req.body;

        // Validate scores
        if (scoreA === undefined || scoreB === undefined) {
            return res.status(400).json({
                success: false,
                message: "Both scores are required",
            });
        }

        if (scoreA === scoreB) {
            return res.status(400).json({
                success: false,
                message: "Scores cannot be equal",
            });
        }

        // Get match
        const match = await Match.findById(matchId).populate("gameId");
        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found",
            });
        }

        const game = await Game.findById(match.gameId);
        if (!game) {
            return res.status(404).json({
                success: false,
                message: "Game not found",
            });
        }
        console.log('🏓 [Backend] Match found, game details:', {
            gameId: game._id.toString(),
            gameType: game.type,
            currentRound: game.currentRound,
            matchRound: match.roundNumber,
        });

        // Update match
        match.scoreA = scoreA;
        match.scoreB = scoreB;
        match.winner = scoreA > scoreB ? "A" : "B";
        match.status = "finished";
        await match.save();

        // Update team wins and points
        const winnerLetter = match.winner === "A" ? match.teamA.letter : match.teamB.letter;
        const team = game.teams.find((t) => t.letter === winnerLetter);
        if (team) {
            team.wins = (team.wins || 0) + 1;
            team.totalPoints = (team.totalPoints || 0) + 2; // +2 points for match win

            // Add +1 individual point to each player on the winning team
            for (const player of team.players) {
                if (player.userId) {
                    // Registered player - award points directly
                    await User.findByIdAndUpdate(player.userId, {
                        $inc: { individualPoints: 1 }
                    });
                } else if (player.mobile) {
                    // Unregistered player - track points in UnregisteredPlayer model
                    await addPointsToUnregisteredPlayer(player.mobile, 1);
                    await updateUnregisteredPlayerStats(player.mobile, {
                        totalGames: 1,
                        totalWins: 1
                    });
                    // Track participation in this match
                    await trackUnregisteredPlayerParticipation(player.mobile, {
                        gameId: game._id,
                        matchId: match._id
                    });
                }
            }
        }

        await game.save();

        // Check if all matches in current round are finished
        const allMatches = await Match.find({ gameId: game._id }).sort({ roundNumber: 1, matchNumber: 1 });
        const currentRoundMatches = allMatches.filter((m) => m.roundNumber === game.currentRound);
        const allFinished = currentRoundMatches.every((m) => m.status === "finished");

        // If round is complete and not round-robin, create next round
        let nextRoundCreated = false;
        let newMatches = [];

        if (allFinished && game.type !== "round-robin") {
            // Generate next round matches
            newMatches = await generateNextRoundMatches(game, game.currentRound, allMatches);

            if (newMatches.length > 0) {
                console.log('🏓 [Backend] Creating new matches, count:', newMatches.length);
                // Create new matches
                const createdMatchIds = [];
                for (const matchData of newMatches) {
                    console.log('🏓 [Backend] Processing match data:', {
                        round: matchData.roundNumber,
                        match: matchData.matchNumber,
                        teamA: matchData.teamA?.letter,
                        teamB: matchData.teamB?.letter,
                        bracketType: matchData.bracketType,
                        isBye: matchData.isBye,
                    });
                    // Handle bye matches - create match where team automatically wins
                    if (matchData.isBye) {
                        const teamData = game.teams.find((t) => t.letter === matchData.teamA.letter);
                        if (!teamData) {
                            console.error("Team not found for bye match");
                            continue;
                        }

                        // Create bye match where team automatically wins (plays against BYE)
                        const byeTeamB = matchData.teamB && matchData.teamB.letter === "BYE"
                            ? matchData.teamB
                            : createByeTeam(teamData);

                        const byeMatch = new Match({
                            gameId: game._id,
                            roundNumber: matchData.roundNumber,
                            matchNumber: matchData.matchNumber,
                            teamA: {
                                letter: teamData.letter,
                                players: teamData.players.map((p) => ({
                                    userId: p.userId || null,
                                    name: p.name,
                                    mobile: p.mobile || null,
                                })),
                                points: teamData.totalPoints || 0,
                            },
                            teamB: {
                                letter: byeTeamB.letter,
                                players: byeTeamB.players.map((p) => ({
                                    userId: p.userId || null,
                                    name: p.name || "Bye",
                                    mobile: p.mobile || null,
                                })),
                                points: byeTeamB.points || 0,
                            },
                            scoreA: 21,
                            scoreB: 0,
                            winner: "A",
                            status: "finished",
                            bracketType: matchData.bracketType || null,
                            isBye: true,
                        });

                        await byeMatch.save();
                        createdMatchIds.push(byeMatch._id);

                        // Update team wins and points
                        teamData.wins = (teamData.wins || 0) + 1;
                        teamData.totalPoints = (teamData.totalPoints || 0) + 2; // +2 points for match win (bye match)

                        // Add +1 individual point to each player on the winning team (bye match)
                        for (const player of teamData.players) {
                            if (player.userId) {
                                // Registered player - award points directly
                                await User.findByIdAndUpdate(player.userId, {
                                    $inc: { individualPoints: 1 }
                                });
                            } else if (player.mobile) {
                                // Unregistered player - track points in UnregisteredPlayer model
                                await addPointsToUnregisteredPlayer(player.mobile, 1);
                                await updateUnregisteredPlayerStats(player.mobile, {
                                    totalGames: 1,
                                    totalWins: 1
                                });
                                // Track participation in this match
                                await trackUnregisteredPlayerParticipation(player.mobile, {
                                    gameId: game._id,
                                    matchId: byeMatch._id
                                });
                            }
                        }

                        await game.save();
                        continue;
                    }

                    // Find team data from game.teams
                    const teamAData = game.teams.find((t) => t.letter === matchData.teamA.letter);
                    // Handle BYE team - if teamB is BYE, use the BYE team object directly
                    const isByeTeam = matchData.teamB && matchData.teamB.letter === "BYE";
                    const teamBData = matchData.teamB && !isByeTeam
                        ? game.teams.find((t) => t.letter === matchData.teamB.letter)
                        : (isByeTeam ? matchData.teamB : null);

                    if (!teamAData || (matchData.teamB && !isByeTeam && !teamBData)) {
                        console.error("Team not found for match generation", {
                            teamA: matchData.teamA?.letter,
                            teamB: matchData.teamB?.letter,
                            isByeTeam
                        });
                        continue;
                    }

                    const newMatch = new Match({
                        gameId: game._id,
                        roundNumber: matchData.roundNumber,
                        matchNumber: matchData.matchNumber,
                        teamA: {
                            letter: teamAData.letter,
                            players: teamAData.players.map((p) => ({
                                userId: p.userId || null,
                                name: p.name,
                                mobile: p.mobile || null,
                            })),
                            points: teamAData.totalPoints || 0,
                        },
                        teamB: teamBData
                            ? {
                                letter: teamBData.letter,
                                players: isByeTeam
                                    ? (teamBData.players || [])
                                    : teamBData.players.map((p) => ({
                                        userId: p.userId || null,
                                        name: p.name,
                                        mobile: p.mobile || null,
                                    })),
                                points: teamBData.points || teamBData.totalPoints || 0,
                            }
                            : null,
                        status: "pending",
                        bracketType: matchData.bracketType || null,
                        isBye: matchData.isBye || false,
                    });

                    await newMatch.save();
                    createdMatchIds.push(newMatch._id);
                    console.log('🏓 [Backend] Match created and saved:', {
                        matchId: newMatch._id.toString(),
                        round: newMatch.roundNumber,
                        matchNumber: newMatch.matchNumber,
                    });
                }

                console.log('🏓 [Backend] All matches created, total:', createdMatchIds.length);

                // Update game with new matches and increment round
                if (createdMatchIds.length > 0) {
                    console.log('🏓 [Backend] Updating game with new matches:', {
                        createdMatchIdsCount: createdMatchIds.length,
                        currentRound: game.currentRound,
                        nextRound: newMatches[0].roundNumber,
                    });
                    game.matches = [...game.matches, ...createdMatchIds];
                    game.currentRound = newMatches[0].roundNumber;
                    await game.save();
                    nextRoundCreated = true;

                    // Reload matches
                    const updatedMatches = await Match.find({ gameId: game._id }).sort({
                        roundNumber: 1,
                        matchNumber: 1,
                    });
                    // Convert createdMatchIds to strings for comparison
                    const createdMatchIdStrings = createdMatchIds.map(id => id.toString());
                    console.log('🏓 [Backend] Reloading matches after creation:', {
                        createdMatchIdsCount: createdMatchIds.length,
                        createdMatchIds: createdMatchIdStrings,
                        totalMatches: updatedMatches.length,
                        allMatchIds: updatedMatches.map(m => m._id.toString()),
                    });
                    // Filter to get only the newly created matches
                    const newMatchesArray = [];
                    for (const match of updatedMatches) {
                        const matchIdStr = match._id.toString();
                        if (createdMatchIdStrings.includes(matchIdStr)) {
                            newMatchesArray.push(match);
                            console.log('🏓 [Backend] Found new match:', {
                                matchId: matchIdStr,
                                round: match.roundNumber,
                                match: match.matchNumber,
                                teamA: match.teamA?.letter,
                                teamB: match.teamB?.letter,
                                status: match.status,
                            });
                        }
                    }
                    newMatches = newMatchesArray;
                    console.log('🏓 [Backend] Filtered new matches count:', newMatches.length);
                    console.log('🏓 [Backend] New matches details:', newMatches.map(m => ({
                        id: m._id.toString(),
                        round: m.roundNumber,
                        match: m.matchNumber,
                        teamA: m.teamA?.letter,
                        teamB: m.teamB?.letter,
                    })));

                    // Check if all Round 2 matches are already finished (all bye matches)
                    // If so, try to generate Round 3. If Round 3 can't be generated, complete the game.
                    if (game.type === "quick-knockout" && game.currentRound === 2) {
                        const round2Matches = updatedMatches.filter(m => m.roundNumber === 2);
                        const allRound2Finished = round2Matches.length > 0 && round2Matches.every(m => m.status === "finished");

                        if (allRound2Finished) {
                            console.log('🏓 [Backend] All Round 2 matches finished, checking if game should complete...');
                            // Try to generate Round 3
                            const round3Matches = await generateNextRoundMatches(game, 2, updatedMatches);
                            if (round3Matches.length === 0) {
                                console.log('🏓 [Backend] No Round 3 to generate, completing game');
                                game.status = "completed";
                                await game.save();
                            }
                        }
                    }
                } else {
                    // No more rounds, game is complete
                    game.status = "completed";
                    await game.save();
                }
            } else {
                // No more rounds to generate, game is complete
                game.status = "completed";
                await game.save();
            }
        } else if (allFinished && game.type === "round-robin") {
            // Round Robin is complete after all matches finish
            game.status = "completed";
            await game.save();
        }

        // Reload game with updated matches
        const updatedGame = await Game.findById(game._id)
            .populate("matches")
            .populate("createdBy", "username displayName")
            .populate("roomId", "name code");

        console.log('🏓 [Backend] Final response data:', {
            allRoundFinished: allFinished,
            nextRoundCreated: nextRoundCreated,
            newMatchesCount: newMatches.length,
            newMatchesDetails: newMatches.map(m => ({
                _id: m._id?.toString() || 'no-id',
                round: m.roundNumber,
                match: m.matchNumber,
                teamA: m.teamA?.letter,
                teamB: m.teamB?.letter,
                status: m.status,
            })),
            updatedGameMatchesCount: updatedGame?.matches?.length || 0,
        });

        res.status(200).json({
            success: true,
            message: "Match result submitted",
            match,
            game: updatedGame,
            allRoundMatchesFinished: allFinished,
            nextRoundCreated: nextRoundCreated,
            newMatches: newMatches,
        });
    } catch (error) {
        console.error("Error submitting match result:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// Calculate winners and assign medals
const calculateWinners = async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await Game.findById(gameId).populate("matches");

        if (!game) {
            return res.status(404).json({
                success: false,
                message: "Game not found",
            });
        }

        if (game.type === "round-robin") {
            // Round Robin: Rank by wins
            const sortedTeams = [...game.teams].sort((a, b) => (b.wins || 0) - (a.wins || 0));

            if (sortedTeams.length >= 1) {
                sortedTeams[0].medal = "gold";
                game.medals.gold.team = sortedTeams[0].letter;
                game.medals.gold.players = sortedTeams[0].players
                    .filter((p) => p.userId)
                    .map((p) => p.userId);
            }
            if (sortedTeams.length >= 2) {
                sortedTeams[1].medal = "silver";
                game.medals.silver.team = sortedTeams[1].letter;
                game.medals.silver.players = sortedTeams[1].players
                    .filter((p) => p.userId)
                    .map((p) => p.userId);
            }
            if (sortedTeams.length >= 3) {
                sortedTeams[2].medal = "bronze";
                game.medals.bronze.team = sortedTeams[2].letter;
                game.medals.bronze.players = sortedTeams[2].players
                    .filter((p) => p.userId)
                    .map((p) => p.userId);
            }
        } else if (game.type === "pickle") {
            // Pickle Format: Final winner gets Gold, Final loser gets Silver, Losers bracket winner gets Bronze
            const finalMatch = game.matches.find((m) => m.bracketType === "final" && m.status === "finished");

            if (finalMatch) {
                const winner = finalMatch.winner === "A" ? finalMatch.teamA : finalMatch.teamB;
                const loser = finalMatch.winner === "A" ? finalMatch.teamB : finalMatch.teamA;

                // Assign gold and silver
                game.medals.gold.team = winner.letter;
                game.medals.silver.team = loser.letter;

                const winnerTeam = game.teams.find((t) => t.letter === winner.letter);
                const loserTeam = game.teams.find((t) => t.letter === loser.letter);

                if (winnerTeam) {
                    winnerTeam.medal = "gold";
                    game.medals.gold.players = winnerTeam.players
                        .filter((p) => p.userId)
                        .map((p) => p.userId);
                }
                if (loserTeam) {
                    loserTeam.medal = "silver";
                    game.medals.silver.players = loserTeam.players
                        .filter((p) => p.userId)
                        .map((p) => p.userId);
                }

                // Find losers bracket winner (bronze)
                const losersBracketMatches = game.matches.filter(
                    (m) => m.bracketType === "losers" && m.status === "finished"
                );
                const lastLosersMatch = losersBracketMatches[losersBracketMatches.length - 1];
                if (lastLosersMatch && lastLosersMatch.winner) {
                    const bronzeWinner =
                        lastLosersMatch.winner === "A"
                            ? lastLosersMatch.teamA
                            : lastLosersMatch.teamB;
                    const bronzeTeam = game.teams.find((t) => t.letter === bronzeWinner.letter);

                    if (bronzeTeam) {
                        bronzeTeam.medal = "bronze";
                        game.medals.bronze.team = bronzeWinner.letter;
                        game.medals.bronze.players = bronzeTeam.players
                            .filter((p) => p.userId)
                            .map((p) => p.userId);
                    }
                }
            }
        } else if (game.type === "quick-knockout") {
            // Quick Knockout: Final winner gets Gold, Final loser gets Silver, Bronze match winner gets Bronze
            const finalMatch = game.matches.find((m) => m.bracketType === "final" && m.status === "finished");
            const bronzeMatch = game.matches.find((m) => m.bracketType === "bronze" && m.status === "finished");

            if (finalMatch) {
                const winner = finalMatch.winner === "A" ? finalMatch.teamA : finalMatch.teamB;
                const loser = finalMatch.winner === "A" ? finalMatch.teamB : finalMatch.teamA;

                // Assign gold and silver
                game.medals.gold.team = winner.letter;
                game.medals.silver.team = loser.letter;

                const winnerTeam = game.teams.find((t) => t.letter === winner.letter);
                const loserTeam = game.teams.find((t) => t.letter === loser.letter);

                if (winnerTeam) {
                    winnerTeam.medal = "gold";
                    game.medals.gold.players = winnerTeam.players
                        .filter((p) => p.userId)
                        .map((p) => p.userId);
                }
                if (loserTeam) {
                    loserTeam.medal = "silver";
                    game.medals.silver.players = loserTeam.players
                        .filter((p) => p.userId)
                        .map((p) => p.userId);
                }

                // Assign bronze from bronze match
                if (bronzeMatch && bronzeMatch.winner) {
                    const bronzeWinner =
                        bronzeMatch.winner === "A" ? bronzeMatch.teamA : bronzeMatch.teamB;
                    const bronzeTeam = game.teams.find((t) => t.letter === bronzeWinner.letter);

                    if (bronzeTeam) {
                        bronzeTeam.medal = "bronze";
                        game.medals.bronze.team = bronzeWinner.letter;
                        game.medals.bronze.players = bronzeTeam.players
                            .filter((p) => p.userId)
                            .map((p) => p.userId);
                    }
                }
            }
        } else if (game.type === "one-vs-one" || game.type === "two-vs-two") {
            // 1 vs 1 and 2 vs 2: Single match, winner gets Gold, loser gets Silver
            // Find the finished match (should be the only match for 1v1/2v2)
            // For 1v1/2v2, there's only one match, so find any finished match
            const finalMatch = game.matches.find((m) => m.status === "finished" && m.winner);

            console.log(`🏆 [CalculateWinners] 1v1/2v2 - Found match:`, {
                matchFound: !!finalMatch,
                winner: finalMatch?.winner,
                teamALetter: finalMatch?.teamA?.letter,
                teamBLetter: finalMatch?.teamB?.letter,
                gameTeams: game.teams.map(t => t.letter),
                allMatches: game.matches.map(m => ({
                    id: m._id,
                    status: m.status,
                    winner: m.winner,
                    bracketType: m.bracketType
                }))
            });

            if (finalMatch && finalMatch.winner) {
                const winnerLetter = finalMatch.winner === "A" ? finalMatch.teamA.letter : finalMatch.teamB.letter;
                const loserLetter = finalMatch.winner === "A" ? finalMatch.teamB.letter : finalMatch.teamA.letter;

                // Initialize medals if not already initialized
                if (!game.medals) {
                    game.medals = {
                        gold: { team: null, players: [] },
                        silver: { team: null, players: [] },
                        bronze: { team: null, players: [] }
                    };
                }

                // Assign gold and silver
                game.medals.gold.team = winnerLetter;
                game.medals.silver.team = loserLetter;

                const winnerTeam = game.teams.find((t) => t.letter === winnerLetter);
                const loserTeam = game.teams.find((t) => t.letter === loserLetter);

                console.log(`🏆 [CalculateWinners] Teams found:`, {
                    winnerLetter,
                    loserLetter,
                    winnerTeam: winnerTeam ? winnerTeam.letter : 'NOT FOUND',
                    loserTeam: loserTeam ? loserTeam.letter : 'NOT FOUND',
                    gameTeamsLetters: game.teams.map(t => t.letter)
                });

                if (winnerTeam) {
                    winnerTeam.medal = "gold";
                    game.medals.gold.players = winnerTeam.players
                        .filter((p) => p.userId)
                        .map((p) => p.userId);
                    console.log(`🏆 [CalculateWinners] Gold medal assigned to Team ${winnerLetter}`);
                }
                if (loserTeam) {
                    loserTeam.medal = "silver";
                    game.medals.silver.players = loserTeam.players
                        .filter((p) => p.userId)
                        .map((p) => p.userId);
                    console.log(`🏆 [CalculateWinners] Silver medal assigned to Team ${loserLetter}`);
                }

                console.log(`🏆 [CalculateWinners] Final medals:`, {
                    gold: game.medals.gold.team,
                    silver: game.medals.silver.team
                });
            } else {
                console.log(`🏆 [CalculateWinners] No finished match found for 1v1/2v2 game`);
            }
        }

        game.status = "completed";
        await game.save();

        res.status(200).json({
            success: true,
            message: "Winners calculated successfully",
            game,
        });
    } catch (error) {
        console.error("Error calculating winners:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// Assign points based on medals
const assignPoints = async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await Game.findById(gameId);

        if (!game) {
            return res.status(404).json({
                success: false,
                message: "Game not found",
            });
        }

        if (game.pointsAssigned) {
            return res.status(200).json({
                success: true,
                message: "Points already assigned",
            });
        }

        const pointValues = {
            gold: { individual: 3, team: 4 },
            silver: { individual: 1, team: 2 },
            bronze: { individual: 1, team: 1 },
        };

        // Assign points for medal winners
        for (const medalType of ["gold", "silver", "bronze"]) {
            const medalData = game.medals[medalType];
            if (medalData.team) {
                // Find the team that won this medal
                const medalTeam = game.teams.find((t) => t.letter === medalData.team);
                if (!medalTeam) continue;

                const points = pointValues[medalType];
                const totalPlayers = medalTeam.players.length;
                const teamPointsPerPlayer = points.team / totalPlayers;

                // Award points to all players on the medal-winning team
                for (const player of medalTeam.players) {
                    if (player.userId) {
                        // Registered player - award points directly
                        await User.findByIdAndUpdate(player.userId, {
                            $inc: {
                                individualPoints: points.individual,
                                teamPoints: teamPointsPerPlayer
                            },
                        });
                    } else if (player.mobile) {
                        // Unregistered player - track points in UnregisteredPlayer model
                        await addPointsToUnregisteredPlayer(player.mobile, points.individual);
                        // Note: Team points can be tracked separately if needed
                        // For now, we'll track them as individual points
                    }
                }
            }
        }

        // Assign participation points (0.5 points) to all other players
        const allRegisteredPlayerIds = new Set();
        const allUnregisteredPlayers = new Set(); // Store mobile numbers
        const medalWinnersRegistered = new Set();
        const medalWinnersUnregistered = new Set(); // Store mobile numbers

        // Collect all players
        game.teams.forEach((team) => {
            team.players.forEach((player) => {
                if (player.userId) {
                    allRegisteredPlayerIds.add(player.userId.toString());
                } else if (player.mobile) {
                    const normalizedMobile = player.mobile.replace(/[\s\-+()]/g, '').replace(/^91/, '').slice(-10);
                    allUnregisteredPlayers.add(normalizedMobile);
                }
            });
        });

        // Collect medal winners (both registered and unregistered)
        for (const medalType of ["gold", "silver", "bronze"]) {
            const medalData = game.medals[medalType];
            if (medalData && medalData.team) {
                const medalTeam = game.teams.find((t) => t.letter === medalData.team);
                if (medalTeam) {
                    medalTeam.players.forEach((player) => {
                        if (player.userId) {
                            medalWinnersRegistered.add(player.userId.toString());
                        } else if (player.mobile) {
                            const normalizedMobile = player.mobile.replace(/[\s\-+()]/g, '').replace(/^91/, '').slice(-10);
                            medalWinnersUnregistered.add(normalizedMobile);
                        }
                    });
                }
            }
        }

        // Remove medal winners from participation list
        medalWinnersRegistered.forEach((playerId) => {
            allRegisteredPlayerIds.delete(playerId);
        });
        medalWinnersUnregistered.forEach((mobile) => {
            allUnregisteredPlayers.delete(mobile);
        });

        // Assign participation points to registered players (0.5 individual points)
        for (const playerId of allRegisteredPlayerIds) {
            await User.findByIdAndUpdate(playerId, {
                $inc: { individualPoints: 0.5 },
            });
        }

        // Assign participation points to unregistered players (0.5 individual points)
        for (const mobile of allUnregisteredPlayers) {
            await addPointsToUnregisteredPlayer(mobile, 0.5);
        }

        // Update user statistics (totalGames, totalWins, streak)
        // Collect all registered players and determine who won (got a medal)
        const allPlayerIds = new Set();
        const medalWinnersSet = new Set(); // Players who got gold, silver, or bronze

        // Collect all players first
        game.teams.forEach((team) => {
            team.players.forEach((player) => {
                if (player.userId) {
                    allPlayerIds.add(player.userId.toString());
                }
            });
        });

        // Collect medal winners (gold, silver, bronze all count as wins)
        for (const medalType of ["gold", "silver", "bronze"]) {
            const medalData = game.medals[medalType];
            if (medalData && medalData.team) {
                const medalTeam = game.teams.find((t) => t.letter === medalData.team);
                if (medalTeam) {
                    medalTeam.players.forEach((player) => {
                        if (player.userId) {
                            medalWinnersSet.add(player.userId.toString());
                        }
                    });
                }
            }
        }

        // Update stats for all registered players
        for (const userId of allPlayerIds) {
            const user = await User.findById(userId);
            if (!user) continue;

            // Initialize stats if not exists
            if (!user.stats || typeof user.stats !== 'object') {
                user.stats = {
                    totalGames: 0,
                    totalWins: 0,
                    streak: 0
                };
            }

            // Ensure stats fields exist
            if (typeof user.stats.totalGames !== 'number') user.stats.totalGames = 0;
            if (typeof user.stats.totalWins !== 'number') user.stats.totalWins = 0;
            if (typeof user.stats.streak !== 'number') user.stats.streak = 0;

            // Increment totalGames for all players who participated
            user.stats.totalGames = (user.stats.totalGames || 0) + 1;

            // Check if player won (got a medal)
            const won = medalWinnersSet.has(userId);

            if (won) {
                // Increment totalWins for medal winners
                user.stats.totalWins = (user.stats.totalWins || 0) + 1;

                // Update streak - increment if won
                const currentStreak = user.stats.streak || 0;
                user.stats.streak = currentStreak + 1;
            } else {
                // If player didn't win, reset streak to 0
                user.stats.streak = 0;
            }

            // Mark stats as modified to ensure Mongoose saves it
            user.markModified('stats');
            await user.save();
        }

        game.pointsAssigned = true;
        await game.save();

        res.status(200).json({
            success: true,
            message: "Points assigned successfully",
            game,
        });
    } catch (error) {
        console.error("Error assigning points:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// READ - Get recent games for current user across all rooms
const getUserRecentGames = async (req, res) => {
    try {
        const userId = req.user._id;
        const limit = parseInt(req.query.limit) || 10;

        // Find all games where user is in any team or created the game
        const games = await Game.find({
            $or: [
                { createdBy: userId },
                { 'teams.players.userId': userId }
            ],
            status: 'completed'
        })
            .populate('roomId', 'name code')
            .populate('createdBy', 'username displayName')
            .select('type status championTeam medals createdAt roomId createdBy teams')
            .sort({ createdAt: -1 })
            .limit(limit);

        // Format games for frontend
        const formattedGames = games.map(game => {
            // Find user's team in this game
            let userTeam = null;
            let userPoints = 0;

            for (const team of game.teams) {
                const isInTeam = team.players.some(p =>
                    p.userId && p.userId.toString() === userId.toString()
                );
                if (isInTeam) {
                    userTeam = team.letter;
                    userPoints = team.totalPoints || 0;
                    break;
                }
            }

            // Get winner team name
            let winnerTeam = null;
            if (game.medals?.gold?.team) {
                winnerTeam = `Team ${game.medals.gold.team}`;
            } else if (game.championTeam) {
                winnerTeam = `Team ${game.championTeam}`;
            }

            // Get game type display name
            const gameTypeNames = {
                'pickle': 'Pickle Format',
                'round-robin': 'Round Robin',
                'quick-knockout': 'Quick Knockout',
                'one-vs-one': '1 vs 1',
                'two-vs-two': '2 vs 2'
            };

            return {
                id: game._id,
                room: game.roomId?.name || 'Unknown Room',
                roomCode: game.roomId?.code || '',
                gameType: gameTypeNames[game.type] || game.type,
                date: game.createdAt,
                winner: winnerTeam,
                points: userPoints,
                userTeam: userTeam ? `Team ${userTeam}` : null,
                status: game.status
            };
        });

        res.status(200).json({
            success: true,
            count: formattedGames.length,
            games: formattedGames,
        });
    } catch (error) {
        console.error("Error getting user recent games:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

// READ - Get active game for a room
const getActiveGameForRoom = async (req, res) => {
    try {
        const { roomId } = req.params;

        // Only find active games (pending or live), NOT completed games
        const activeGame = await Game.findOne({
            roomId: roomId,
            status: { $in: ['pending', 'live'] }
        })
            .populate('matches')
            .populate('createdBy', 'username displayName')
            .populate('roomId', 'name code')
            .sort({ createdAt: -1 });

        if (!activeGame) {
            return res.status(200).json({
                success: true,
                hasActiveGame: false,
                game: null,
            });
        }

        res.status(200).json({
            success: true,
            hasActiveGame: true,
            game: activeGame,
        });
    } catch (error) {
        console.error("Error getting active game for room:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message,
        });
    }
};

export { createGame, getGameById, submitMatchResult, calculateWinners, assignPoints, getUserRecentGames, getActiveGameForRoom };

