// Double Elimination Bracket Logic
// Based on standard tournament bracket algorithms

class DoubleEliminationBracket {
    constructor(teams) {
        this.teams = [...teams];
        this.matchResults = {};
        this.tournamentWinner = null;
        this.bracket = this.generateBracket();
        // Track losses for each team
        this.teamLosses = {};
        teams.forEach(team => {
            this.teamLosses[team] = 0;
        });
    }

    recalculateTeamLosses() {
        Object.keys(this.teamLosses).forEach(team => {
            this.teamLosses[team] = 0;
        });
        Object.values(this.matchResults).forEach(result => {
            const loser = result.loser;
            if (loser && loser !== 'BYE' && loser !== 'TBD') {
                this.teamLosses[loser] = (this.teamLosses[loser] || 0) + 1;
            }
        });
    }

    generateBracket() {
        const shuffled = [...this.teams].sort(() => Math.random() - 0.5);
        const size = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
        const byesNeeded = size - shuffled.length;
        
        // Add BYEs
        const participants = [...shuffled];
        for (let i = 0; i < byesNeeded; i++) {
            participants.push('BYE');
        }

        // Generate winners bracket
        const winners = this.generateWinnersBracket(participants);
        
        // Generate losers bracket
        const losers = this.generateLosersBracket(winners.length);
        
        // Generate finals
        const finals = [
            [{ id: 'F1', team1: 'TBD', team2: 'TBD', round: 1, bracket: 'finals' }],
            [{ id: 'F2', team1: 'TBD', team2: 'TBD', round: 2, bracket: 'finals', note: 'Only if losers bracket winner wins F1' }]
        ];

        return { winners, losers, finals };
    }

    generateWinnersBracket(participants) {
        const rounds = [];
        let currentTeams = participants;
        let roundNum = 1;

        while (currentTeams.length > 1) {
            const round = [];
            for (let i = 0; i < currentTeams.length; i += 2) {
                round.push({
                    id: `W${roundNum}-${Math.floor(i / 2) + 1}`,
                    team1: currentTeams[i],
                    team2: currentTeams[i + 1],
                    round: roundNum,
                    bracket: 'winners'
                });
            }
            rounds.push(round);
            
            // Next round has TBD teams
            currentTeams = new Array(round.length).fill('TBD');
            roundNum++;
        }

        return rounds;
    }

    generateLosersBracket(winnersRounds) {
        const rounds = [];
        if (winnersRounds <= 1) return rounds;

        const totalRounds = 2 * (winnersRounds - 1);

        for (let i = 0; i < totalRounds; i++) {
            const round = [];
            const pairIndex = Math.floor(i / 2);
            const exponent = winnersRounds - pairIndex - 2;
            const matchCount = Math.max(1, Math.pow(2, Math.max(0, exponent)));

            for (let j = 0; j < matchCount; j++) {
                round.push({
                    id: `L${i + 1}-${j + 1}`,
                    team1: 'TBD',
                    team2: 'TBD',
                    round: i + 1,
                    bracket: 'losers'
                });
            }

            rounds.push(round);
        }

        return rounds;
    }

    recordMatchResult(matchId, winnerTeam, loserTeam) {
        this.matchResults[matchId] = { winner: winnerTeam, loser: loserTeam };
        
        // Track losses
        if (loserTeam !== 'BYE' && loserTeam !== 'TBD') {
            if (!this.teamLosses[loserTeam]) {
                this.teamLosses[loserTeam] = 0;
            }
            this.teamLosses[loserTeam]++;
            console.log(`${loserTeam} now has ${this.teamLosses[loserTeam]} loss(es)`);
            
            // Check if team is eliminated (2 losses)
            if (this.teamLosses[loserTeam] >= 2) {
                console.log(`${loserTeam} is ELIMINATED with 2 losses`);
            }
        }
        
        this.advanceWinner(matchId, winnerTeam, loserTeam);
    }

    advanceWinner(matchId, winner, loser) {
        const match = this.findMatch(matchId);
        if (!match) return;

        console.log(`Advancing winner from ${matchId}: ${winner} beats ${loser}`);

        if (match.bracket === 'winners') {
            // Advance winner in winners bracket
            const nextMatch = this.getNextWinnersMatch(match);
            if (nextMatch) {
                console.log(`  Winner ${winner} advances to ${nextMatch.id}`);
                this.placeTeamInMatch(nextMatch, winner);
            } else {
                console.log(`  No next winners match (going to finals)`);
            }
            
            // Drop loser to losers bracket (even if it's BYE to keep bracket balanced)
            if (loser !== 'TBD') {
                console.log(`  Attempting to drop loser ${loser} to losers bracket...`);
                const losersMatch = this.getDropdownMatch(match);
                if (losersMatch) {
                    console.log(`  Loser ${loser} drops to ${losersMatch.id}`);
                    this.placeTeamInMatch(losersMatch, loser);
                } else {
                    console.log(`  WARNING: No losers match found for loser ${loser} from ${matchId}`);
                }
            }
        } else if (match.bracket === 'losers') {
            // Advance winner in losers bracket
            const nextMatch = this.getNextLosersMatch(match);
            if (nextMatch) {
                console.log(`  Winner ${winner} advances in losers to ${nextMatch.id}`);
                this.placeTeamInMatch(nextMatch, winner);
            }
        } else if (match.bracket === 'finals') {
            if (match.id === 'F1') {
                if (match.team1 === winner) {
                    this.tournamentWinner = winner;
                } else {
                    const f2 = this.findMatch('F2');
                    if (f2) {
                        f2.team1 = match.team1;
                        f2.team2 = match.team2;
                    }
                }
            } else if (match.id === 'F2') {
                this.tournamentWinner = winner;
            }
        }
    }

    findMatch(matchId) {
        for (let rounds of [this.bracket.winners, this.bracket.losers, this.bracket.finals]) {
            for (let round of rounds) {
                const match = round.find(m => m.id === matchId);
                if (match) return match;
            }
        }
        return null;
    }

    getNextWinnersMatch(match) {
        const roundIdx = match.round - 1;
        if (roundIdx >= this.bracket.winners.length - 1) {
            console.log(`  Last winners round, advancing to F1`);
            return this.findMatch('F1');
        }
        
        const nextRound = this.bracket.winners[roundIdx + 1];
        const matchIdx = this.bracket.winners[roundIdx].findIndex(m => m.id === match.id);
        const targetIdx = Math.floor(matchIdx / 2);
        const targetMatch = nextRound[targetIdx];
        console.log(`  Next winners match: ${targetMatch.id} (current: ${targetMatch.team1} vs ${targetMatch.team2})`);
        return targetMatch;
    }

    getNextLosersMatch(match) {
        const roundIdx = match.round - 1;
        
        // Find the next non-empty losers round
        for (let nextRoundIdx = roundIdx + 1; nextRoundIdx < this.bracket.losers.length; nextRoundIdx++) {
            const nextRound = this.bracket.losers[nextRoundIdx];
            if (nextRound && nextRound.length > 0) {
                // Found a non-empty round
                const matchIdx = this.bracket.losers[roundIdx].findIndex(m => m.id === match.id);
                const currentMatches = this.bracket.losers[roundIdx].length;
                const nextMatches = nextRound.length;
                const ratio = currentMatches / nextMatches;
                const targetIdx = ratio <= 1 ? matchIdx : Math.floor(matchIdx / ratio);
                console.log(`  Advancing from L${match.round} to L${nextRoundIdx + 1} (skipped ${nextRoundIdx - roundIdx - 1} empty rounds)`);
                return nextRound[Math.min(targetIdx, nextRound.length - 1)];
            }
        }
        
        // No more losers rounds, advance to finals
        console.log(`  No more losers rounds, advancing to F1`);
        return this.findMatch('F1');
    }

    getDropdownMatch(winnersMatch) {
        const winnersRound = winnersMatch.round;
        // Winners Round 1 losers drop to L1, subsequent winners rounds drop to every second losers round
        const losersRoundIdx = winnersRound === 1
            ? 0
            : (winnersRound - 1) * 2 - 1;
        
        console.log(`  Dropping from Winners Round ${winnersRound} to Losers Round ${losersRoundIdx + 1} (index ${losersRoundIdx})`);
        console.log(`  Total losers rounds: ${this.bracket.losers.length}`);
        
        // Special case: If this is the last winners round (finals of winners bracket),
        // the loser doesn't drop to losers bracket - they go directly to Finals
        if (losersRoundIdx >= this.bracket.losers.length) {
            console.log(`  Last winners round - loser goes to Finals, not losers bracket`);
            return null; // Will be handled in advanceWinner to go to Finals
        }
        
        const losersRound = this.bracket.losers[losersRoundIdx];
        if (!losersRound || losersRound.length === 0) {
            console.log(`  Losers round at index ${losersRoundIdx} is empty or doesn't exist`);
            return null;
        }
        
        const matchIdx = this.bracket.winners[winnersMatch.round - 1].findIndex(m => m.id === winnersMatch.id);
        const winnersMatches = this.bracket.winners[winnersMatch.round - 1].length;
        const losersMatches = losersRound.length;
        const ratio = winnersMatches / losersMatches;
        const targetIdx = ratio <= 1 ? matchIdx : Math.floor(matchIdx / ratio);
        const targetMatch = losersRound[Math.min(targetIdx, losersRound.length - 1)];
        
        console.log(`  Match index ${matchIdx} in winners round, targeting losers match index ${targetIdx}`);
        console.log(`  Target match:`, targetMatch);
        
        return targetMatch;
    }

    placeTeamInMatch(match, team, role) {
        console.log(`Placing ${team} in ${match.id}, current: ${match.team1} vs ${match.team2}`);
        
        // Prioritize filling TBD slots before reusing BYE placeholders
        if (match.team1 === 'TBD') {
            match.team1 = team;
            console.log(`  -> Placed in team1 (was TBD)`);
            return;
        }
        if (match.team2 === 'TBD') {
            match.team2 = team;
            console.log(`  -> Placed in team2 (was TBD)`);
            return;
        }
        if (match.team1 === 'BYE') {
            match.team1 = team;
            console.log(`  -> Placed in team1 (was BYE)`);
            return;
        }
        if (match.team2 === 'BYE') {
            match.team2 = team;
            console.log(`  -> Placed in team2 (was BYE)`);
            return;
        }
        console.log(`  -> WARNING: Both slots filled (${match.team1} vs ${match.team2}), unable to place ${team}`);
    }

    autoAdvanceByes() {
        let hasChanges = true;
        let iterations = 0;
        
        while (hasChanges && iterations < 50) {
            hasChanges = false;
            iterations++;
            
            // First pass: Mark TBD vs TBD matches in Round 1 as BYE vs BYE (they're truly empty)
            if (this.bracket.winners[0]) {
                for (let match of this.bracket.winners[0]) {
                    if (this.matchResults[match.id]) continue;
                    if (match.team1 === 'TBD' && match.team2 === 'TBD') {
                        match.team1 = 'BYE';
                        match.team2 = 'BYE';
                        hasChanges = true;
                    }
                }
            }
            
            // Second pass: Handle BYE matches
            for (let rounds of [this.bracket.winners, this.bracket.losers]) {
                for (let round of rounds) {
                    for (let match of round) {
                        if (this.matchResults[match.id]) continue;
                        
                        // Handle BYE vs BYE - mark as complete, don't advance anyone
                        if (match.team1 === 'BYE' && match.team2 === 'BYE') {
                            this.matchResults[match.id] = { winner: 'BYE', loser: 'BYE' };
                            const nextMatch = match.bracket === 'winners'
                                ? this.getNextWinnersMatch(match)
                                : this.getNextLosersMatch(match);
                            if (nextMatch) {
                                this.placeTeamInMatch(nextMatch, 'BYE');
                            }
                            if (match.bracket === 'winners') {
                                const dropdownMatch = this.getDropdownMatch(match);
                                if (dropdownMatch) {
                                    this.placeTeamInMatch(dropdownMatch, 'BYE');
                                }
                            }
                            hasChanges = true;
                        }
                        // Auto-advance team vs BYE (but NOT team vs TBD!)
                        else if (match.team2 === 'BYE' && match.team1 !== 'TBD' && match.team1 !== 'BYE') {
                            this.recordMatchResult(match.id, match.team1, 'BYE');
                            hasChanges = true;
                        } else if (match.team1 === 'BYE' && match.team2 !== 'TBD' && match.team2 !== 'BYE') {
                            this.recordMatchResult(match.id, match.team2, 'BYE');
                            hasChanges = true;
                        }
                        // DO NOT convert TBD to BYE - let matches wait for real teams
                    }
                }
            }
        }
    }
}
