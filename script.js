let teams = [];
let bracketManager = null;
let bracket = null;
let matchResults = {};
let tournamentWinner = null;
let rankings = [];

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const tabs = ['teams', 'bracket', 'schedule', 'rankings'];
    const tabIndex = tabs.indexOf(tabName);
    
    if (tabIndex !== -1) {
        document.querySelectorAll('.tab-btn')[tabIndex].classList.add('active');
        const tabElement = document.getElementById(tabName + 'Tab');
        if (tabElement) {
            tabElement.classList.add('active');
        }
    }
}

function addTeams() {
    const input = document.getElementById('teamNameInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    const inputTeams = text.split(/[\n,;|]/)
        .map(t => t.trim())
        .filter(t => t);
    
    const duplicates = [];
    const newTeams = [];
    
    inputTeams.forEach(team => {
        if (teams.includes(team)) {
            duplicates.push(team);
        } else if (!newTeams.includes(team)) {
            newTeams.push(team);
        } else {
            duplicates.push(team);
        }
    });
    
    teams.push(...newTeams);
    input.value = '';
    
    if (duplicates.length > 0) {
        showWarning(`Duplicate team names removed: ${duplicates.join(', ')}`);
    } else {
        hideWarning();
    }
    
    renderTeamList();
}

function showWarning(message) {
    const warningEl = document.getElementById('warningMessage');
    warningEl.textContent = '⚠️ ' + message;
    warningEl.style.display = 'block';
    setTimeout(() => hideWarning(), 5000);
}

function hideWarning() {
    const warningEl = document.getElementById('warningMessage');
    warningEl.style.display = 'none';
}

function removeTeam(teamName) {
    teams = teams.filter(t => t !== teamName);
    renderTeamList();
}

function renderTeamList() {
    const teamList = document.getElementById('teamList');
    if (teams.length === 0) {
        teamList.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No teams added yet</p>';
        return;
    }
    teamList.innerHTML = teams.map(team => `
        <div class="team-item">
            <span>${escapeHtml(team)}</span>
            <button class="remove-btn" onclick="removeTeam('${escapeHtml(team)}')">Remove</button>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function generateBracket() {
    if (teams.length < 2) {
        alert('Please add at least 2 teams');
        return;
    }
    
    // Use the new bracket manager
    bracketManager = new DoubleEliminationBracket(teams);
    bracketManager.autoAdvanceByes();
    
    // Sync with old variables for compatibility
    bracket = bracketManager.bracket;
    matchResults = bracketManager.matchResults;
    tournamentWinner = bracketManager.tournamentWinner;
    
    // Initialize rankings with all teams
    rankings = teams.map(team => ({
        team: team,
        wins: 0,
        losses: 0,
        placement: null,
        eliminatedInRound: null,
        eliminatedInBracket: null
    }));
    
    switchTab('bracket');
    renderBracket();
    renderSchedule();
    renderRankings();
}

function autoAdvanceByes() {
    // Find all matches with BYE and auto-advance
    // Keep looping until no more changes (cascading BYE advancements)
    let hasChanges = true;
    let iterations = 0;
    const maxIterations = 50; // Prevent infinite loops (increased for larger brackets)
    
    while (hasChanges && iterations < maxIterations) {
        hasChanges = false;
        iterations++;
        
        console.log(`Auto-advance iteration ${iterations}`);
        
        // First pass: Handle BYE vs BYE matches
        bracket.winners.forEach(round => {
            round.forEach(match => {
                if (matchResults[match.id]) return;
                
                // Handle BYE vs BYE - mark as completed with no winner advancing
                if (match.team1 === 'BYE' && match.team2 === 'BYE') {
                    matchResults[match.id] = { winner: 'BYE', loser: 'BYE' };
                    hasChanges = true;
                    
                    // Mark next match slots as BYE since no one advances
                    const nextMatch = findNextMatch(match, 'winners');
                    if (nextMatch) {
                        const matchIdx = bracket.winners[match.round - 1].findIndex(m => m.id === match.id);
                        if (matchIdx % 2 === 0) {
                            if (nextMatch.team1 === 'TBD') {
                                nextMatch.team1 = 'BYE';
                                hasChanges = true;
                            }
                        } else {
                            if (nextMatch.team2 === 'TBD') {
                                nextMatch.team2 = 'BYE';
                                hasChanges = true;
                            }
                        }
                    }
                    return;
                }
                
                // Auto-advance if one team is BYE and the other is a real team (not TBD)
                if (match.team2 === 'BYE' && match.team1 !== 'TBD' && match.team1 !== 'BYE') {
                    matchResults[match.id] = { winner: match.team1, loser: 'BYE' };
                    updateBracket(match.id, match.team1, 'BYE');
                    hasChanges = true;
                } else if (match.team1 === 'BYE' && match.team2 !== 'TBD' && match.team2 !== 'BYE') {
                    matchResults[match.id] = { winner: match.team2, loser: 'BYE' };
                    updateBracket(match.id, match.team2, 'BYE');
                    hasChanges = true;
                }
            });
        });
        
        // Check losers bracket
        bracket.losers.forEach(round => {
            round.forEach(match => {
                if (matchResults[match.id]) return;
                
                // Handle BYE vs BYE in losers bracket
                if (match.team1 === 'BYE' && match.team2 === 'BYE') {
                    matchResults[match.id] = { winner: 'BYE', loser: 'BYE' };
                    hasChanges = true;
                    
                    // Mark next match slots as BYE
                    const nextMatch = findNextMatch(match, 'losers');
                    if (nextMatch) {
                        const matchIdx = bracket.losers[match.round - 1].findIndex(m => m.id === match.id);
                        if (matchIdx % 2 === 0) {
                            if (nextMatch.team1 === 'TBD') {
                                nextMatch.team1 = 'BYE';
                                hasChanges = true;
                            }
                        } else {
                            if (nextMatch.team2 === 'TBD') {
                                nextMatch.team2 = 'BYE';
                                hasChanges = true;
                            }
                        }
                    }
                    return;
                }
                
                if (match.team2 === 'BYE' && match.team1 !== 'TBD' && match.team1 !== 'BYE') {
                    matchResults[match.id] = { winner: match.team1, loser: 'BYE' };
                    updateBracket(match.id, match.team1, 'BYE');
                    hasChanges = true;
                } else if (match.team1 === 'BYE' && match.team2 !== 'TBD' && match.team2 !== 'BYE') {
                    matchResults[match.id] = { winner: match.team2, loser: 'BYE' };
                    updateBracket(match.id, match.team2, 'BYE');
                    hasChanges = true;
                }
            });
        });
        
        // Check finals
        bracket.finals.forEach(round => {
            round.forEach(match => {
                if (matchResults[match.id]) return;
                
                // Handle BYE vs BYE in finals
                if (match.team1 === 'BYE' && match.team2 === 'BYE') {
                    matchResults[match.id] = { winner: 'BYE', loser: 'BYE' };
                    hasChanges = true;
                    return;
                }
                
                if (match.team2 === 'BYE' && match.team1 !== 'TBD' && match.team1 !== 'BYE') {
                    matchResults[match.id] = { winner: match.team1, loser: 'BYE' };
                    updateBracket(match.id, match.team1, 'BYE');
                    hasChanges = true;
                } else if (match.team1 === 'BYE' && match.team2 !== 'TBD' && match.team2 !== 'BYE') {
                    matchResults[match.id] = { winner: match.team2, loser: 'BYE' };
                    updateBracket(match.id, match.team2, 'BYE');
                    hasChanges = true;
                }
            });
        });
        
        // Don't convert TBD to BYE automatically - TBD means waiting for a real match result
    }
}

function renderBracket() {
    if (!bracket) return;
    
    console.log('Rendering bracket with rounds:', {
        winners: bracket.winners.length,
        losers: bracket.losers.length,
        finals: bracket.finals.length
    });
    console.log('Winners Round 1 matches:', bracket.winners[0]);
    
    renderBracketColumn('winnersBracket', bracket.winners, 'Winners');
    renderBracketColumn('losersBracket', bracket.losers, 'Losers');
    renderBracketColumn('finalsBracket', bracket.finals, 'Finals');
    updateWinnerDisplay();
}

function renderBracketColumn(elementId, rounds, bracketName) {
    const container = document.getElementById(elementId);
    if (!container) return;
    
    let html = '';
    rounds.forEach((round, idx) => {
        html += `<div class="round"><div class="round-title">${bracketName} Round ${idx + 1}</div>`;
        
        round.forEach(match => {
            const result = matchResults[match.id];
            const isCompleted = result && result.winner;
            // Simple: allow playing if both teams are present (not TBD)
            const canPlay = match.team1 !== 'TBD' && match.team2 !== 'TBD';
            
            let matchClass = 'match';
            if (canPlay && !isCompleted) matchClass += ' can-play';
            if (isCompleted) matchClass += ' completed';
            
            const matchDblClick = isCompleted ? `ondblclick="resetMatch('${match.id}')"` : '';
            
            html += `<div class="${matchClass}" ${matchDblClick}>`;
            html += `<div class="match-id">${match.id}${isCompleted ? ' <span style="font-size: 10px; color: #7f8c8d;">(double-click to change)</span>' : ''}</div>`;
            
            // Team 1
            let team1Class = 'team';
            if (match.team1 === 'BYE') team1Class += ' bye';
            if (result && result.winner === match.team1) team1Class += ' winner';
            if (result && result.loser === match.team1) team1Class += ' loser';
            
            const team1Click = canPlay && !isCompleted && match.team1 !== 'BYE' ? `onclick="selectTeamAsWinner('${match.id}', '${match.team1}')"` : '';
            html += `<div class="${team1Class}" ${team1Click}>${match.team1}</div>`;
            
            // Team 2
            let team2Class = 'team';
            if (match.team2 === 'BYE') team2Class += ' bye';
            if (result && result.winner === match.team2) team2Class += ' winner';
            if (result && result.loser === match.team2) team2Class += ' loser';
            
            const team2Click = canPlay && !isCompleted && match.team2 !== 'BYE' ? `onclick="selectTeamAsWinner('${match.id}', '${match.team2}')"` : '';
            html += `<div class="${team2Class}" ${team2Click}>${match.team2}</div>`;
            
            if (match.note) {
                html += `<div style="font-size: 12px; color: #e74c3c; margin-top: 5px;">${match.note}</div>`;
            }
            
            html += '</div>';
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}

function selectTeamAsWinner(matchId, teamName) {
    const match = bracketManager.findMatch(matchId);
    if (!match) return;
    
    // Don't allow selecting if both teams are TBD or BYE
    if ((match.team1 === 'TBD' || match.team1 === 'BYE') && 
        (match.team2 === 'TBD' || match.team2 === 'BYE')) {
        return;
    }
    
    const winnerTeam = teamName;
    let loserTeam = match.team1 === teamName ? match.team2 : match.team1;
    
    // If opponent is TBD or BYE, treat as BYE
    if (loserTeam === 'TBD' || loserTeam === 'BYE') {
        loserTeam = 'BYE';
    }
    
    bracketManager.recordMatchResult(matchId, winnerTeam, loserTeam);
    
    // Sync state
    matchResults = bracketManager.matchResults;
    tournamentWinner = bracketManager.tournamentWinner;
    
    updateRankings(winnerTeam, loserTeam, match);
    renderBracket();
    renderSchedule();
    renderRankings();
}

function resetMatch(matchId) {
    const match = bracketManager.findMatch(matchId);
    if (!match) return;
    
    // Get the current result
    const currentResult = bracketManager.matchResults[matchId];
    if (!currentResult) return;
    
    // Ask which team should win
    const choice = prompt(`Reselect winner for ${matchId}:\n1. ${match.team1}\n2. ${match.team2}\n\nEnter 1 or 2:`);
    
    if (choice === '1' || choice === '2') {
        const newWinner = choice === '1' ? match.team1 : match.team2;
        let newLoser = choice === '1' ? match.team2 : match.team1;

        if (!newWinner || newWinner === 'TBD' || newWinner === 'BYE') return;
        if (newLoser === 'TBD') newLoser = 'BYE';

        const oldWinner = currentResult.winner;
        const oldLoser = currentResult.loser;

        if (newWinner === oldWinner && newLoser === oldLoser) {
            return; // No change
        }

        swapTeamsInBracket(oldWinner, newWinner);

        bracketManager.matchResults[matchId] = { winner: newWinner, loser: newLoser };

        bracketManager.recalculateTeamLosses();
        bracketManager.autoAdvanceByes();
        matchResults = { ...bracketManager.matchResults };
        bracket = bracketManager.bracket;
        tournamentWinner = bracketManager.tournamentWinner;
        rebuildRankingsFromResults();

        renderBracket();
        renderSchedule();
        renderRankings();
    }
}

function swapTeamsInBracket(oldTeam, newTeam) {
    if (!oldTeam || !newTeam || oldTeam === newTeam) return;

    const isPlaceholder = (name) => name === 'BYE' || name === 'TBD';
    const swapBothWays = !isPlaceholder(oldTeam) && !isPlaceholder(newTeam);

    const swapName = (name) => {
        if (name === oldTeam) return newTeam;
        if (swapBothWays && name === newTeam) return oldTeam;
        return name;
    };

    const swapInRounds = (rounds) => {
        rounds.forEach(round => {
            round.forEach(match => {
                match.team1 = swapName(match.team1);
                match.team2 = swapName(match.team2);
            });
        });
    };

    if (bracketManager && bracketManager.bracket) {
        swapInRounds(bracketManager.bracket.winners);
        swapInRounds(bracketManager.bracket.losers);
        swapInRounds(bracketManager.bracket.finals);
    }

    if (bracketManager && bracketManager.matchResults) {
        Object.values(bracketManager.matchResults).forEach(result => {
            result.winner = swapName(result.winner);
            result.loser = swapName(result.loser);
        });
    }
}

function findMatch(matchId) {
    for (let rounds of [bracket.winners, bracket.losers, bracket.finals]) {
        for (let round of rounds) {
            const match = round.find(m => m.id === matchId);
            if (match) return match;
        }
    }
    return null;
}

function updateBracket(matchId, winner, loser) {
    const match = findMatch(matchId);
    if (!match) return;
    
    if (match.team2 === 'BYE') {
        winner = match.team1;
        loser = 'BYE';
    }
    
    updateRankings(winner, loser, match);
    
    if (match.bracket === 'winners') {
        const nextWinnersMatch = findNextMatch(match, 'winners');
        if (nextWinnersMatch) {
            if (nextWinnersMatch.id === 'F1') {
                advanceTeamToMatch(nextWinnersMatch, winner, 1); // Winners champ goes to team1
            } else {
                advanceTeamToMatch(nextWinnersMatch, winner);
            }
        }
        
        if (loser !== 'BYE') {
            const nextLosersMatch = findNextLosersMatch(match);
            if (nextLosersMatch) {
                // Losers from winners go to team2 slot in losers bracket
                advanceTeamToMatch(nextLosersMatch, loser, 2);
            }
        }
    } else if (match.bracket === 'losers') {
        const nextLosersMatch = findNextMatch(match, 'losers');
        if (nextLosersMatch) {
            if (nextLosersMatch.id === 'F1') {
                advanceTeamToMatch(nextLosersMatch, winner, 2); // Losers champ goes to team2
            } else {
                advanceTeamToMatch(nextLosersMatch, winner, 1); // Losers winners go to team1
            }
        }
    } else if (match.bracket === 'finals') {
        if (match.id === 'F1') {
            const f2 = findMatch('F2');
            if (match.team1 === winner) {
                // Winners bracket champion won - tournament over
                tournamentWinner = winner;
            } else {
                // Losers bracket champion won - need F2
                advanceTeamToMatch(f2, match.team1, 1);
                advanceTeamToMatch(f2, match.team2, 2);
            }
        } else if (match.id === 'F2') {
            tournamentWinner = winner;
        }
    }
}

function findNextMatch(currentMatch, bracketType) {
    const rounds = bracketType === 'winners' ? bracket.winners : bracketType === 'losers' ? bracket.losers : bracket.finals;
    const currentRoundIdx = rounds.findIndex(round => round.some(m => m.id === currentMatch.id));
    
    if (currentRoundIdx === -1) return null;
    
    // Check if this is the last round
    if (currentRoundIdx >= rounds.length - 1) {
        if (bracketType === 'winners' && currentRoundIdx === rounds.length - 1) {
            // Winners bracket champion goes to F1 team1
            return findMatch('F1');
        } else if (bracketType === 'losers' && currentRoundIdx === rounds.length - 1) {
            // Losers bracket champion goes to F1 team2
            return findMatch('F1');
        }
        return null;
    }
    
    const nextRound = rounds[currentRoundIdx + 1];
    if (!nextRound || nextRound.length === 0) return null;
    
    const matchIndexInRound = rounds[currentRoundIdx].findIndex(m => m.id === currentMatch.id);
    
    if (bracketType === 'losers') {
        // In losers bracket:
        // - Odd rounds (L1, L3...): winners go to next even round
        // - Even rounds (L2, L4...): winners go to next odd round
        const isOddRound = (currentRoundIdx % 2) === 0;
        
        if (isOddRound) {
            // From odd round: winner goes to corresponding slot in next even round
            const nextMatchIndex = matchIndexInRound;
            return nextRound[Math.min(nextMatchIndex, nextRound.length - 1)];
        } else {
            // From even round: winners play each other in next odd round
            const nextMatchIndex = Math.floor(matchIndexInRound / 2);
            return nextRound[Math.min(nextMatchIndex, nextRound.length - 1)];
        }
    } else {
        // Winners bracket: standard advancement
        const nextMatchIndex = Math.floor(matchIndexInRound / 2);
        return nextRound[Math.min(nextMatchIndex, nextRound.length - 1)];
    }
}

function findNextLosersMatch(winnersMatch) {
    // In double elimination:
    // - Losers from Winners Round 1 go to Losers Round 1 (odd round)
    // - Losers from Winners Round 2 go to Losers Round 3 (odd round)
    // - Losers from Winners Round N go to Losers Round (2N-1) (odd round)
    
    const winnersRound = winnersMatch.round;
    const losersRoundIdx = (winnersRound * 2) - 1; // Convert to 0-indexed
    
    if (losersRoundIdx < 0 || losersRoundIdx >= bracket.losers.length) {
        return null;
    }
    
    const losersRound = bracket.losers[losersRoundIdx];
    if (!losersRound || losersRound.length === 0) return null;
    
    // Find which match in the losers round this team should go to
    const winnersRoundMatches = bracket.winners[winnersMatch.round - 1];
    const matchIdx = winnersRoundMatches.findIndex(m => m.id === winnersMatch.id);
    const targetIdx = Math.floor(matchIdx / 2);
    
    return losersRound[Math.min(targetIdx, losersRound.length - 1)];
}

function advanceTeamToMatch(match, team, preferredSlot) {
    // Don't advance BYE to next matches
    if (team === 'BYE') return;
    
    if (preferredSlot === 1 && match.team1 === 'TBD') {
        match.team1 = team;
    } else if (preferredSlot === 2 && match.team2 === 'TBD') {
        match.team2 = team;
    } else if (match.team1 === 'TBD') {
        match.team1 = team;
    } else if (match.team2 === 'TBD') {
        match.team2 = team;
    }
}

function updateWinnerDisplay() {
    const winnerDisplay = document.getElementById('winnerDisplay');
    const championName = document.getElementById('championName');
    
    if (tournamentWinner) {
        championName.textContent = tournamentWinner;
        winnerDisplay.style.display = 'block';
    } else {
        winnerDisplay.style.display = 'none';
    }
}

function renderSchedule() {
    const container = document.getElementById('scheduleContent');
    
    if (!bracket) {
        container.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 40px;">Generate a bracket first to see the schedule</p>';
        return;
    }
    
    const schedule = calculateParallelSchedule();
    
    let html = '';
    schedule.forEach((roundGroup, idx) => {
        const completedCount = roundGroup.filter(m => matchResults[m.id]).length;
        const totalCount = roundGroup.length;
        const allCompleted = completedCount === totalCount;
        
        html += `<div class="round-group ${allCompleted ? 'completed-round' : ''}">`;
        html += `<div class="round-group-title">Time Slot ${idx + 1} - ${roundGroup.length} game(s) can be played simultaneously`;
        html += allCompleted ? ' ✓ Completed' : ` (${completedCount}/${totalCount} completed)`;
        html += '</div>';
        
        roundGroup.forEach(match => {
            const result = matchResults[match.id];
            html += `<div class="parallel-match ${result ? 'completed-match' : ''}">`;
            html += `<strong>${match.id}:</strong> ${match.team1} vs ${match.team2}`;
            html += ` <span style="color: #7f8c8d;">(${match.bracket})</span>`;
            if (result) {
                html += `<span style="color: #27ae60; margin-left: 10px;">Winner: ${result.winner}</span>`;
            }
            html += '</div>';
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
}

function calculateParallelSchedule() {
    const schedule = [];
    
    const firstRound = bracket.winners[0].filter(m => m.team1 !== 'TBD' && m.team2 !== 'TBD');
    if (firstRound.length > 0) {
        schedule.push(firstRound.map(m => ({...m, bracket: 'Winners'})));
    }
    
    for (let i = 1; i < bracket.winners.length; i++) {
        const round = bracket.winners[i];
        schedule.push(round.map(m => ({...m, bracket: 'Winners'})));
    }
    
    bracket.losers.forEach(round => {
        schedule.push(round.map(m => ({...m, bracket: 'Losers'})));
    });
    
    bracket.finals.forEach(round => {
        schedule.push(round.map(m => ({...m, bracket: 'Finals'})));
    });
    
    return schedule;
}

function updateRankings(winner, loser, match) {
    if (loser === 'BYE') return;
    
    if (!rankings.find(r => r.team === winner)) {
        rankings.push({ team: winner, wins: 0, losses: 0, placement: null, eliminatedInRound: null, eliminatedInBracket: null });
    }
    if (!rankings.find(r => r.team === loser)) {
        rankings.push({ team: loser, wins: 0, losses: 0, placement: null, eliminatedInRound: null, eliminatedInBracket: null });
    }
    
    const winnerRank = rankings.find(r => r.team === winner);
    const loserRank = rankings.find(r => r.team === loser);
    
    winnerRank.wins++;
    loserRank.losses++;
    
    // Track where teams were eliminated
    loserRank.eliminatedInRound = match.round;
    loserRank.eliminatedInBracket = match.bracket;
    
    // Assign placements based on where teams are eliminated
    if (match.bracket === 'finals') {
        if (match.id === 'F2') {
            // Grand finals reset loser is 2nd place
            loserRank.placement = 2;
        } else if (match.id === 'F1') {
            // F1 loser goes to F2 if from winners, or is 2nd place if from losers
            const isFromLosers = match.team2 === loser;
            if (isFromLosers) {
                loserRank.placement = 2;
            }
        }
    } else if (match.bracket === 'losers') {
        // Losers bracket placements based on round from the end
        const totalLosersRounds = bracket.losers.length;
        const roundsFromEnd = totalLosersRounds - match.round;
        
        if (roundsFromEnd === 0) {
            // Lost in final losers round = 3rd place
            loserRank.placement = 3;
        } else if (roundsFromEnd === 1) {
            // Lost one round before losers finals = 4th place
            loserRank.placement = 4;
        } else {
            // Calculate placement for earlier rounds
            // Each losers round eliminates teams at specific placements
            const placement = 4 + (totalLosersRounds - match.round);
            loserRank.placement = placement;
        }
    }
}

function rebuildRankingsFromResults() {
    rankings = teams.map(team => ({
        team,
        wins: 0,
        losses: 0,
        placement: null,
        eliminatedInRound: null,
        eliminatedInBracket: null
    }));

    const entries = Object.entries(bracketManager.matchResults);
    entries.sort((a, b) => {
        const matchA = bracketManager.findMatch(a[0]);
        const matchB = bracketManager.findMatch(b[0]);
        const keyA = buildMatchSortKey(matchA, a[0]);
        const keyB = buildMatchSortKey(matchB, b[0]);
        return keyA.localeCompare(keyB);
    });

    entries.forEach(([matchId, result]) => {
        const match = bracketManager.findMatch(matchId);
        if (!match) return;
        updateRankings(result.winner, result.loser, match);
    });
}

function buildMatchSortKey(match, matchId) {
    if (!match) return `Z-${matchId}`;
    const bracketOrder = match.bracket === 'winners' ? 'A' : match.bracket === 'losers' ? 'B' : 'C';
    const round = String(match.round).padStart(2, '0');
    const parts = matchId.split('-');
    const indexPart = parts.length > 1 ? parts[1] : '1';
    const index = String(indexPart).padStart(2, '0');
    return `${bracketOrder}-${round}-${index}-${matchId}`;
}

function renderRankings() {
    const container = document.getElementById('rankingsContent');
    
    if (!bracket || rankings.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 40px;">Complete matches to see rankings</p>';
        return;
    }
    
    // Recalculate wins and losses from match results
    const teamStats = {};
    for (let matchId in matchResults) {
        const result = matchResults[matchId];
        if (result.winner !== 'BYE') {
            if (!teamStats[result.winner]) teamStats[result.winner] = { wins: 0, losses: 0 };
            teamStats[result.winner].wins++;
        }
        if (result.loser !== 'BYE') {
            if (!teamStats[result.loser]) teamStats[result.loser] = { wins: 0, losses: 0 };
            teamStats[result.loser].losses++;
        }
    }
    
    // Use the loss tracker from bracketManager for accurate loss count
    if (bracketManager && bracketManager.teamLosses) {
        for (let team in bracketManager.teamLosses) {
            if (!teamStats[team]) teamStats[team] = { wins: 0, losses: 0 };
            teamStats[team].losses = bracketManager.teamLosses[team];
        }
    }
    
    // Update rankings with correct stats
    rankings.forEach(rank => {
        if (teamStats[rank.team]) {
            rank.wins = teamStats[rank.team].wins;
            rank.losses = teamStats[rank.team].losses;
        }
    });
    
    // Set champion placement
    if (tournamentWinner) {
        const champion = rankings.find(r => r.team === tournamentWinner);
        if (champion) champion.placement = 1;
    }
    
    // Sort by placement first, then by wins/losses
    const sortedRankings = [...rankings].sort((a, b) => {
        // Teams with placement come first
        if (a.placement && !b.placement) return -1;
        if (!a.placement && b.placement) return 1;
        
        // Both have placement - sort by placement number, then by record for ties
        if (a.placement && b.placement) {
            if (a.placement !== b.placement) return a.placement - b.placement;
            // Same placement - sort by record
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.losses - b.losses;
        }
        
        // Neither has placement - sort by record
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.losses - b.losses;
    });
    
    // Assign consecutive display positions (no gaps)
    let currentPosition = 1;
    sortedRankings.forEach((rank) => {
        rank.displayPosition = currentPosition;
        currentPosition++;
    });
    
    // Get selected count
    const topCountSelect = document.getElementById('topCount');
    const topCountValue = topCountSelect ? topCountSelect.value : '5';
    const topCount = topCountValue === 'all' ? sortedRankings.length : parseInt(topCountValue);
    
    // Filter to top N
    const topRankings = sortedRankings.slice(0, topCount);
    
    let html = '';
    
    // Show warning if tournament is incomplete
    if (!tournamentWinner) {
        html += '<div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; color: #856404; border: 2px solid #ffc107;">';
        html += '⚠️ <strong>Tournament in progress</strong> - Rankings are preliminary. Complete all matches to see final standings.';
        html += '</div>';
    }
    
    // Check for teams with only 1 loss (shouldn't happen in double elimination)
    const teamsWithOneLoss = sortedRankings.filter(r => r.losses === 1 && !r.placement);
    if (teamsWithOneLoss.length > 0) {
        html += '<div style="background: #ffe6e6; padding: 15px; border-radius: 8px; margin-bottom: 20px; color: #c00; border: 2px solid #f00;">';
        html += '⚠️ <strong>Bracket Error:</strong> The following teams have only 1 loss but are not advancing: ';
        html += teamsWithOneLoss.map(r => r.team).join(', ');
        html += '. This indicates a bracket routing issue.';
        html += '</div>';
    }
    
    html += '<div class="rankings-list">';
    topRankings.forEach((rank) => {
        const position = rank.displayPosition;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
        const status = !rank.placement ? ' <span style="font-size: 0.8em; color: #7f8c8d;">(Estimated)</span>' : '';
        
        html += `<div class="ranking-item rank-${Math.min(position, 5)}">`;
        html += `<div class="rank-position">${medal} ${position}${status}</div>`;
        html += `<div class="rank-team">${rank.team}</div>`;
        html += `<div class="rank-stats">${rank.wins}W - ${rank.losses}L</div>`;
        html += '</div>';
    });
    html += '</div>';
    
    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    renderTeamList();
});
