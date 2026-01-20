function initClientUI() {
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('viewTabs').classList.remove('hidden');
    document.getElementById('userInfo').textContent = `Client: ${state.connection.client_name}`;
    
    // Hide hoster-only tabs
    document.querySelector('.tab[data-view="clients"]').classList.add('hidden');
    
    initCalendar();
    loadClientCalendarData();
    
    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view;
            switchClientView(view);
        });
    });
    
    // Client request modal
    document.getElementById('confirmClientRequest').addEventListener('click', handleClientRequest);
    document.getElementById('closeClientRequestModal').addEventListener('click', hideClientRequestModal);
}

function switchClientView(view) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.tab[data-view="${view}"]`).classList.add('active');
    
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`${view}View`).classList.remove('hidden');
    
    if (view === 'requests') {
        loadClientRequests();
    } else if (view === 'appointments') {
        loadClientAppointments();
    }
}

async function loadClientCalendarData() {
    try {
        // Load hoster timeslots
        const timeslotsRes = await fetch(`${SERV_ADDRESS}/api/client/${state.connectionId}/timeslots`);
        const timeslotsData = await timeslotsRes.json();
        if (timeslotsData.success) {
            state.timeslots = timeslotsData.timeslots;
        }
        
        // Load client requests
        const requestsRes = await fetch(`${SERV_ADDRESS}/api/client/${state.connectionId}/requests`);
        const requestsData = await requestsRes.json();
        if (requestsData.success) {
            state.requests = requestsData.requests;
        }
        
        // Load appointments
        const appointmentsRes = await fetch(`${SERV_ADDRESS}/api/client/${state.connectionId}/appointments`);
        const appointmentsData = await appointmentsRes.json();
        if (appointmentsData.success) {
            state.appointments = appointmentsData.appointments;
        }
        
        renderCalendarEvents();
    } catch (error) {
        console.error('Failed to load calendar data:', error);
    }
}

let clientSelectionTimeslot = null;

function startClientSelection(timeslot) {
    clientSelectionTimeslot = timeslot;
    
    // Enable selection mode
    state.isSelecting = false;
    
    // Add click handlers to calendar cells within the timeslot
    const timeslotStart = new Date(timeslot.start_time);
    const timeslotEnd = new Date(timeslot.end_time);
    
    const cells = document.querySelectorAll('.calendar-cell');
    cells.forEach(cell => {
        const cellTime = new Date(cell.dataset.datetime);
        
        if (cellTime >= timeslotStart && cellTime < timeslotEnd) {
            cell.style.border = '2px solid #007bff';
            
            // Override handlers for client selection
            cell.addEventListener('mousedown', handleClientCellMouseDown);
            cell.addEventListener('mouseenter', handleClientCellMouseEnter);
            cell.addEventListener('mouseup', handleClientCellMouseUp);
            
            cell.addEventListener('touchstart', handleClientCellTouchStart);
            cell.addEventListener('touchmove', handleClientCellTouchMove);
            cell.addEventListener('touchend', handleClientCellTouchEnd);
        }
    });
}

function handleClientCellMouseDown(e) {
    state.isSelecting = true;
    state.selectionStart = e.target;
    state.selectedCells = [e.target];
    e.target.classList.add('selecting');
}

function handleClientCellMouseEnter(e) {
    if (!state.isSelecting) return;
    
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

function handleClientCellMouseUp(e) {
    if (!state.isSelecting) return;
    
    state.isSelecting = false;
    
    if (state.selectedCells.length > 0) {
        const start = new Date(state.selectedCells[0].dataset.datetime);
        const end = new Date(state.selectedCells[state.selectedCells.length - 1].dataset.datetime);
        end.setMinutes(end.getMinutes() + 15);
        
        // Validate selection is within timeslot
        const timeslotStart = new Date(clientSelectionTimeslot.start_time);
        const timeslotEnd = new Date(clientSelectionTimeslot.end_time);
        
        if (start >= timeslotStart && end <= timeslotEnd) {
            showClientRequestModal(start, end, clientSelectionTimeslot.id);
        } else {
            alert('Selection must be within the availability block');
        }
    }
    
    state.selectedCells.forEach(cell => cell.classList.remove('selecting'));
    state.selectedCells = [];
}

function handleClientCellTouchStart(e) {
    e.preventDefault();
    handleClientCellMouseDown({ target: e.target });
}

function handleClientCellTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && element.classList.contains('calendar-cell')) {
        handleClientCellMouseEnter({ target: element });
    }
}

function handleClientCellTouchEnd(e) {
    e.preventDefault();
    handleClientCellMouseUp({ target: e.currentTarget });
}

function showClientRequestModal(start, end, timeslotId) {
    const modal = document.getElementById('clientRequestModal');
    document.getElementById('clientSelectedTimeRange').textContent = 
        `${formatDateTime(start)} - ${formatDateTime(end)}`;
    modal.dataset.start = start.toISOString();
    modal.dataset.end = end.toISOString();
    modal.dataset.timeslotId = timeslotId;
    modal.classList.remove('hidden');
}

function hideClientRequestModal() {
    document.getElementById('clientRequestModal').classList.add('hidden');
}

async function handleClientRequest() {
    const modal = document.getElementById('clientRequestModal');
    const start = modal.dataset.start;
    const end = modal.dataset.end;
    const timeslotId = modal.dataset.timeslotId;
    const preference = document.getElementById('requestPreference').value;
    
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/client/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                connectionId: state.connectionId,
                timeslotId: timeslotId,
                startTime: start,
                endTime: end,
                preference: parseInt(preference)
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideClientRequestModal();
            loadClientCalendarData();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to create request: ' + error.message);
    }
}

async function loadClientRequests() {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/client/${state.connectionId}/requests`);
        const data = await response.json();
        
        if (data.success) {
            renderClientRequestsList(data.requests);
        }
    } catch (error) {
        console.error('Failed to load requests:', error);
    }
}

function renderClientRequestsList(requests) {
    const list = document.getElementById('myRequestsList');
    list.innerHTML = '';
    
    if (requests.length === 0) {
        list.innerHTML = '<p>No requests yet. Select time slots from the calendar.</p>';
        return;
    }
    
    requests.forEach(request => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        item.innerHTML = `
            <h3>${formatDateTime(request.start_time)} - ${formatDateTime(request.end_time)}</h3>
            <p><span class="preference-badge">Preference: ${request.preference}</span></p>
            ${request.validated_by_hoster ? '<p><span class="validated-badge">Validated by Hoster</span></p>' : '<p>Pending validation</p>'}
            <label>Update preference:
                <input type="number" min="1" max="5" value="${request.preference}" onchange="updateRequestPreference(${request.id}, this.value)">
            </label>
            <button class="danger" onclick="deleteClientRequest(${request.id})">Delete Request</button>
        `;
        
        list.appendChild(item);
    });
}

async function updateRequestPreference(requestId, preference) {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/client/requests/${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preference: parseInt(preference) })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadClientRequests();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to update preference: ' + error.message);
    }
}

async function deleteClientRequest(requestId) {
    if (!confirm('Are you sure you want to delete this request?')) {
        return;
    }
    
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/client/requests/${requestId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadClientRequests();
            loadClientCalendarData();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to delete request: ' + error.message);
    }
}

async function loadClientAppointments() {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/client/${state.connectionId}/appointments`);
        const data = await response.json();
        
        if (data.success) {
            renderClientAppointmentsList(data.appointments);
        }
    } catch (error) {
        console.error('Failed to load appointments:', error);
    }
}

function renderClientAppointmentsList(appointments) {
    const list = document.getElementById('appointmentsList');
    list.innerHTML = '';
    
    if (appointments.length === 0) {
        list.innerHTML = '<p>No confirmed appointments.</p>';
        return;
    }
    
    appointments.forEach(appt => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        item.innerHTML = `
            <h3>Confirmed Appointment</h3>
            <p>${formatDateTime(appt.start_time)} - ${formatDateTime(appt.end_time)}</p>
        `;
        
        list.appendChild(item);
    });
}