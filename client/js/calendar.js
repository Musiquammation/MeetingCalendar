function initCalendar() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    state.currentWeekStart = new Date(today);
    state.currentWeekStart.setDate(today.getDate() - dayOfWeek);
    state.currentWeekStart.setHours(0, 0, 0, 0);
    
    document.getElementById('prevWeek').addEventListener('click', () => {
        state.currentWeekStart.setDate(state.currentWeekStart.getDate() - 7);
        renderCalendar();
        loadCalendarData();
    });
    
    document.getElementById('nextWeek').addEventListener('click', () => {
        state.currentWeekStart.setDate(state.currentWeekStart.getDate() + 7);
        renderCalendar();
        loadCalendarData();
    });
    
    document.getElementById('todayBtn').addEventListener('click', () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        state.currentWeekStart = new Date(today);
        state.currentWeekStart.setDate(today.getDate() - dayOfWeek);
        state.currentWeekStart.setHours(0, 0, 0, 0);
        renderCalendar();
        loadCalendarData();
    });
    
    renderCalendar();
}

function renderCalendar() {
    const weekEnd = new Date(state.currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    document.getElementById('currentWeek').textContent = 
        `${formatDate(state.currentWeekStart)} - ${formatDate(weekEnd)}`;
    
    const calendar = document.getElementById('calendar');
    const timeSlots = getTimeSlots();
    
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    grid.style.gridTemplateColumns = '80px repeat(7, 1fr)';
    grid.style.gridTemplateRows = `50px repeat(${timeSlots.length}, 40px)`;
    
    // Header row
    const headerDiv = document.createElement('div');
    headerDiv.className = 'calendar-header';
    
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-header-cell';
    headerDiv.appendChild(emptyCell);
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(state.currentWeekStart);
        date.setDate(date.getDate() + i);
        
        const cell = document.createElement('div');
        cell.className = 'calendar-header-cell';
        cell.textContent = formatDate(date);
        headerDiv.appendChild(cell);
    }
    
    grid.appendChild(headerDiv);
    
    // Time slots
    timeSlots.forEach((slot, slotIndex) => {
        const timeLabel = document.createElement('div');
        timeLabel.className = 'time-label';
        timeLabel.textContent = formatTime(slot.hour, slot.minute);
        grid.appendChild(timeLabel);
        
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const date = new Date(state.currentWeekStart);
            date.setDate(date.getDate() + dayIndex);
            date.setHours(slot.hour);
            date.setMinutes(slot.minute);
            
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            cell.dataset.datetime = date.toISOString();
            cell.dataset.day = dayIndex;
            cell.dataset.slot = slotIndex;
            
            // Mouse events for selection
            cell.addEventListener('mousedown', handleCellMouseDown);
            cell.addEventListener('mouseenter', handleCellMouseEnter);
            cell.addEventListener('mouseup', handleCellMouseUp);
            
            // Touch events for mobile
            cell.addEventListener('touchstart', handleCellTouchStart);
            cell.addEventListener('touchmove', handleCellTouchMove);
            cell.addEventListener('touchend', handleCellTouchEnd);
            
            grid.appendChild(cell);
        }
    });
    
    calendar.innerHTML = '';
    calendar.appendChild(grid);
    
    renderCalendarEvents();
}

function handleCellMouseDown(e) {
    if (state.userType !== 'hoster') return;
    
    state.isSelecting = true;
    state.selectionStart = e.target;
    state.selectedCells = [e.target];
    e.target.classList.add('selecting');
}

function handleCellMouseEnter(e) {
    if (!state.isSelecting || state.userType !== 'hoster') return;
    
    const startDay = parseInt(state.selectionStart.dataset.day);
    const startSlot = parseInt(state.selectionStart.dataset.slot);
    const currentDay = parseInt(e.target.dataset.day);
    const currentSlot = parseInt(e.target.dataset.slot);
    
    if (startDay !== currentDay) return;
    
    state.selectedCells.forEach(cell => cell.classList.remove('selecting'));
    state.selectedCells = [];
    
    const minSlot = Math.min(startSlot, currentSlot);
    const maxSlot = Math.max(startSlot, currentSlot);
    
    const cells = document.querySelectorAll('.calendar-cell');
    cells.forEach(cell => {
        const day = parseInt(cell.dataset.day);
        const slot = parseInt(cell.dataset.slot);
        
        if (day === startDay && slot >= minSlot && slot <= maxSlot) {
            cell.classList.add('selecting');
            state.selectedCells.push(cell);
        }
    });
}

function handleCellMouseUp(e) {
    if (!state.isSelecting || state.userType !== 'hoster') return;
    
    state.isSelecting = false;
    
    if (state.selectedCells.length > 0) {
        const start = new Date(state.selectedCells[0].dataset.datetime);
        const end = new Date(state.selectedCells[state.selectedCells.length - 1].dataset.datetime);
        end.setMinutes(end.getMinutes() + 15);
        
        showCreateAvailabilityModal(start, end);
    }
    
    state.selectedCells.forEach(cell => cell.classList.remove('selecting'));
    state.selectedCells = [];
}

let touchStartCell = null;

function handleCellTouchStart(e) {
    e.preventDefault();
    touchStartCell = e.target;
    
    if (state.userType === 'hoster') {
        handleCellMouseDown({ target: e.target });
    }
}

function handleCellTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && element.classList.contains('calendar-cell')) {
        if (state.userType === 'hoster') {
            handleCellMouseEnter({ target: element });
        }
    }
}

function handleCellTouchEnd(e) {
    e.preventDefault();
    
    if (state.userType === 'hoster') {
        handleCellMouseUp({ target: touchStartCell });
    }
    
    touchStartCell = null;
}

function renderCalendarEvents() {
    // Clear existing events
    document.querySelectorAll('.availability-block, .appointment-block, .request-block').forEach(el => el.remove());
    
    if (state.userType === 'hoster') {
        renderHosterEvents();
    } else if (state.userType === 'client') {
        renderClientEvents();
    }
}

function renderHosterEvents() {
    const cells = Array.from(document.querySelectorAll('.calendar-cell'));
    
    // Render availability blocks
    state.timeslots.forEach(timeslot => {
        const start = new Date(timeslot.start_time);
        const end = new Date(timeslot.end_time);
        
        const startCell = cells.find(cell => {
            const cellTime = new Date(cell.dataset.datetime);
            return cellTime.getTime() === start.getTime();
        });
        
        if (!startCell) return;
        
        const duration = (end - start) / (15 * 60 * 1000);
        const block = document.createElement('div');
        block.className = 'availability-block';
        block.style.height = `${duration * 40}px`;
        block.textContent = `Available ${formatTime(start.getHours(), start.getMinutes())} - ${formatTime(end.getHours(), end.getMinutes())}`;
        block.dataset.timeslotId = timeslot.id;
        
        block.addEventListener('click', (e) => {
            e.stopPropagation();
            showTimeslotRequests(timeslot.id);
        });
        
        startCell.appendChild(block);
    });
    
    // Render appointments
    state.appointments.forEach(appt => {
        const start = new Date(appt.start_time);
        const end = new Date(appt.end_time);
        
        const startCell = cells.find(cell => {
            const cellTime = new Date(cell.dataset.datetime);
            return cellTime.getTime() === start.getTime();
        });
        
        if (!startCell) return;
        
        const duration = (end - start) / (15 * 60 * 1000);
        const block = document.createElement('div');
        block.className = 'appointment-block';
        block.style.height = `${duration * 40}px`;
        block.textContent = `${appt.client_name} ${formatTime(start.getHours(), start.getMinutes())} - ${formatTime(end.getHours(), end.getMinutes())}`;
        
        startCell.appendChild(block);
    });
}

function renderClientEvents() {
    const cells = Array.from(document.querySelectorAll('.calendar-cell'));
    
    // Render hoster availability blocks
    state.timeslots.forEach(timeslot => {
        const start = new Date(timeslot.start_time);
        const end = new Date(timeslot.end_time);
        
        const startCell = cells.find(cell => {
            const cellTime = new Date(cell.dataset.datetime);
            return cellTime.getTime() === start.getTime();
        });
        
        if (!startCell) return;
        
        const duration = (end - start) / (15 * 60 * 1000);
        const block = document.createElement('div');
        block.className = 'availability-block';
        block.style.height = `${duration * 40}px`;
        block.textContent = `Available`;
        block.dataset.timeslotId = timeslot.id;
        
        // Make clickable for client to request
        block.style.cursor = 'pointer';
        block.addEventListener('click', (e) => {
            e.stopPropagation();
            startClientSelection(timeslot);
        });
        
        startCell.appendChild(block);
    });
    
    // Render client's requests
    state.requests.forEach(request => {
        const start = new Date(request.start_time);
        const end = new Date(request.end_time);
        
        const startCell = cells.find(cell => {
            const cellTime = new Date(cell.dataset.datetime);
            return cellTime.getTime() === start.getTime();
        });
        
        if (!startCell) return;
        
        const duration = (end - start) / (15 * 60 * 1000);
        const block = document.createElement('div');
        block.className = 'request-block';
        block.style.height = `${duration * 40}px`;
        block.textContent = `Request (Pref: ${request.preference})`;
        
        startCell.appendChild(block);
    });
    
    // Render appointments
    state.appointments.forEach(appt => {
        const start = new Date(appt.start_time);
        const end = new Date(appt.end_time);
        
        const startCell = cells.find(cell => {
            const cellTime = new Date(cell.dataset.datetime);
            return cellTime.getTime() === start.getTime();
        });
        
        if (!startCell) return;
        
        const duration = (end - start) / (15 * 60 * 1000);
        const block = document.createElement('div');
        block.className = 'appointment-block';
        block.style.height = `${duration * 40}px`;
        block.textContent = `Confirmed`;
        
        startCell.appendChild(block);
    });
}

function startClientSelection(timeslot) {
    // Similar to hoster selection but for client
    alert('Click and drag on the calendar to select your preferred time within this availability block');
}