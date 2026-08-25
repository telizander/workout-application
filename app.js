let workoutData = null;
let selectedWeek = null;
let selectedDay = null;
let currentBlockIndex = 0;
let timerInterval = null;
let startTime = null;
let elapsedTime = 0;
let isRunning = false;
let blockTimes = [];

// Load the JSON data
async function loadData() {
    try {
        const response = await fetch('current.json');
        const data = await response.json();
        workoutData = data.program;
        
        // Set program title and subtitle
        document.getElementById('program-title').textContent = workoutData.title;
        document.getElementById('program-subtitle').textContent = workoutData.subtitle;

        // Program notes are optional — hide the panel when a program omits them
        const notesPanel = document.getElementById('program-notes');
        if (workoutData.notes) {
            document.getElementById('program-notes-body').textContent = workoutData.notes;
            notesPanel.classList.remove('hidden');
        } else {
            notesPanel.classList.add('hidden');
        }

        // Default to the first week in the file
        selectedWeek = Object.keys(workoutData.weeks)[0];

        // Initialize the UI
        renderWeekButtons();
        updatePhaseInfo();
        renderDayGrid();
    } catch (error) {
        console.error('Error loading workout data:', error);
        document.getElementById('day-grid').innerHTML = '<p style="color: #dc2626;">Error loading workout data. Please check that current.json is in the same directory.</p>';
    }
}

function renderWeekButtons() {
    const weekButtonsContainer = document.getElementById('week-buttons');
    weekButtonsContainer.innerHTML = '';
    
    const weeks = Object.keys(workoutData.weeks);
    weeks.forEach(week => {
        const btn = document.createElement('button');
        btn.className = 'week-btn';
        if (week === selectedWeek) btn.classList.add('active');
        btn.dataset.week = week;
        btn.innerHTML = `
            <div class="week-label">WEEK</div>
            <div class="week-num">${week}</div>
        `;
        btn.addEventListener('click', () => selectWeek(week));
        weekButtonsContainer.appendChild(btn);
    });
}

function selectWeek(week) {
    selectedWeek = week;
    
    document.querySelectorAll('.week-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.week === week);
    });
    
    updatePhaseInfo();
    renderDayGrid();
}

function updatePhaseInfo() {
    const weekData = workoutData.weeks[selectedWeek];
    document.getElementById('phase-title').textContent = weekData.phase;
    document.getElementById('phase-goal').textContent = weekData.goal;
}

function renderDayGrid() {
    const dayGrid = document.getElementById('day-grid');
    dayGrid.innerHTML = '';
    
    const days = workoutData.weeks[selectedWeek].days;
    days.forEach(day => {
        const card = document.createElement('button');
        card.className = 'day-card';
        card.innerHTML = `
            <div class="day-header">
                <div class="day-num">DAY ${day.day}</div>
                <svg width="20" height="20" fill="none" stroke="#404040" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6" stroke-width="2"></polyline>
                </svg>
            </div>
            <div class="day-name">${day.name}</div>
            <div class="day-blocks">${day.blocks.length} blocks</div>
        `;
        card.addEventListener('click', () => showWorkout(day.day));
        dayGrid.appendChild(card);
    });
}

function showWorkout(day) {
    selectedDay = day;
    currentBlockIndex = 0;
    blockTimes = [];
    resetTimer();
    
    const dayData = workoutData.weeks[selectedWeek].days.find(d => d.day === day);
    
    document.getElementById('workout-label').textContent = `WEEK ${selectedWeek} / DAY ${day}`;
    document.getElementById('workout-title').textContent = dayData.name;
    
    renderCurrentBlock();
    
    document.getElementById('selection-view').classList.add('hidden');
    document.getElementById('workout-view').classList.add('active');
}

function renderCurrentBlock() {
    const dayData = workoutData.weeks[selectedWeek].days.find(d => d.day === selectedDay);
    const blocks = dayData.blocks;
    const currentBlock = blocks[currentBlockIndex];
    
    const blocksContainer = document.getElementById('workout-blocks');
    blocksContainer.innerHTML = '';
    
    // Timer display
    const timerDiv = document.createElement('div');
    timerDiv.className = 'timer-container';
    timerDiv.innerHTML = `
        <div class="timer-display">
            <div class="timer-label">BLOCK ${currentBlockIndex + 1} OF ${blocks.length}</div>
            <div class="timer-time" id="timer-display">00:00</div>
        </div>
        <div class="timer-controls">
            <button class="timer-btn timer-start" id="start-btn" onclick="startTimer()">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Start
            </button>
            <button class="timer-btn timer-stop hidden" id="stop-btn" onclick="stopTimer()">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
                Stop
            </button>
            <button class="timer-btn timer-reset" id="reset-btn" onclick="resetTimer()">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" stroke-width="2"></path>
                    <path d="M21 3v5h-5" stroke-width="2"></path>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" stroke-width="2"></path>
                    <path d="M3 21v-5h5" stroke-width="2"></path>
                </svg>
                Reset
            </button>
        </div>
    `;
    blocksContainer.appendChild(timerDiv);
    
    // Current block
    const blockDiv = document.createElement('div');
    blockDiv.className = 'block';
    
    const blockType = getBlockType(currentBlock.header);
    const blockLabel = currentBlock.label || currentBlock.header;
    
    let html = `<div class="block-header ${blockType}">${blockLabel}</div>`;
    
    if (currentBlock.note) {
        html += `<div class="block-note">${currentBlock.note}</div>`;
    }
    
    html += '<ul class="exercise-list">';
    currentBlock.exercises.forEach(exercise => {
        html += `<li class="exercise-item">${exercise}</li>`;
    });
    html += '</ul>';
    
    blockDiv.innerHTML = html;
    blocksContainer.appendChild(blockDiv);
    
    // Navigation buttons
    const navDiv = document.createElement('div');
    navDiv.className = 'block-navigation';
    
    if (currentBlockIndex < blocks.length - 1) {
        navDiv.innerHTML = `
            <button class="btn btn-primary" onclick="nextBlock()">
                Next Block
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <polyline points="9 18 15 12 9 6" stroke-width="2"></polyline>
                </svg>
            </button>
        `;
    } else {
        navDiv.innerHTML = `
            <button class="btn btn-primary" onclick="finishWorkout()">
                Finish Workout
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" stroke-width="2"></polyline>
                </svg>
            </button>
        `;
    }
    
    blocksContainer.appendChild(navDiv);
    
    // Show times summary if any blocks completed
    if (blockTimes.length > 0) {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'times-summary';
        summaryDiv.innerHTML = `
            <div class="summary-title">COMPLETED BLOCKS</div>
            <ul class="exercise-list">
                ${blockTimes.map((time, idx) => `
                    <li class="exercise-item">Block ${idx + 1}: ${formatTime(time)}</li>
                `).join('')}
            </ul>
        `;
        blocksContainer.appendChild(summaryDiv);
    }
}

function startTimer() {
    if (!isRunning) {
        isRunning = true;
        startTime = Date.now() - elapsedTime;
        timerInterval = setInterval(updateTimer, 10);
        
        document.getElementById('start-btn').classList.add('hidden');
        document.getElementById('stop-btn').classList.remove('hidden');
    }
}

function stopTimer() {
    if (isRunning) {
        isRunning = false;
        clearInterval(timerInterval);
        
        document.getElementById('start-btn').classList.remove('hidden');
        document.getElementById('stop-btn').classList.add('hidden');
    }
}

function resetTimer() {
    stopTimer();
    elapsedTime = 0;
    updateTimerDisplay();
}

function updateTimer() {
    elapsedTime = Date.now() - startTime;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (display) {
        display.textContent = formatTime(elapsedTime);
    }
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function nextBlock() {
    // Save current block time
    blockTimes.push(elapsedTime);
    
    // Move to next block
    currentBlockIndex++;
    
    // Keep timer running, just reset the display for new block
    elapsedTime = 0;
    if (isRunning) {
        startTime = Date.now();
    }
    
    renderCurrentBlock();
    
    // Update button states if timer was running
    if (isRunning) {
        document.getElementById('start-btn').classList.add('hidden');
        document.getElementById('stop-btn').classList.remove('hidden');
    }
}

function finishWorkout() {
    // Save final block time
    blockTimes.push(elapsedTime);
    stopTimer();
    
    // Show completion summary
    showWorkoutSummary();
}

function showWorkoutSummary() {
    const dayData = workoutData.weeks[selectedWeek].days.find(d => d.day === selectedDay);
    const totalTime = blockTimes.reduce((sum, time) => sum + time, 0);
    
    const blocksContainer = document.getElementById('workout-blocks');
    blocksContainer.innerHTML = '';
    
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'workout-summary';
    summaryDiv.innerHTML = `
        <div class="summary-header">
            <svg width="48" height="48" fill="none" stroke="#86efac" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2"></path>
                <polyline points="22 4 12 14.01 9 11.01" stroke-width="2"></polyline>
            </svg>
            <h2>WORKOUT COMPLETE!</h2>
        </div>
        
        <div class="summary-stat">
            <div class="stat-value">${formatTime(totalTime)}</div>
            <div class="stat-label">TOTAL TIME</div>
        </div>
        
        <div class="block times-summary">
            <div class="block-header work">BLOCK TIMES</div>
            <ul class="exercise-list">
                ${blockTimes.map((time, idx) => {
                    const block = dayData.blocks[idx];
                    const blockLabel = block.label || block.header;
                    return `<li class="exercise-item">${blockLabel}: ${formatTime(time)}</li>`;
                }).join('')}
            </ul>
        </div>
        
        <div class="block-navigation">
            <button class="btn btn-primary" onclick="showSelection()">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <polyline points="15 18 9 12 15 6" stroke-width="2"></polyline>
                </svg>
                Back to Workouts
            </button>
        </div>
    `;
    
    blocksContainer.appendChild(summaryDiv);
}

function getBlockType(header) {
    if (header === 'WU') return 'wu';
    if (header === 'FIN') return 'fin';
    return 'work';
}

function showSelection() {
    selectedDay = null;
    currentBlockIndex = 0;
    blockTimes = [];
    resetTimer();
    
    document.getElementById('selection-view').classList.remove('hidden');
    document.getElementById('workout-view').classList.remove('active');
}

// Event listener for back button
document.getElementById('back-btn').addEventListener('click', showSelection);

// Load data on page load
loadData();
