function initHosterUI() {
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('viewTabs').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('addClientBtn').classList.remove('hidden');
    document.getElementById('userInfo').textContent = `Hoster: ${state.hoster.email}`;
    
    initCalendar();
    loadCalendarData();
    
    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view;
            switchView(view);
        });
    });
    
    // Add client button
    document.getElementById('addClientBtn').addEventListener('click', showAddClientModal);
    document.getElementById('closeAddClientModal').addEventListener('click', hideAddClientModal);
    document.getElementById('clientSearch').addEventListener('input', handleClientSearch);
    document.getElementById('createClientBtn').addEventListener('click', handleCreateClient);
    
    // Create availability modal
    document.getElementById('confirmCreateAvailability').addEventListener('click', handleCreateAvailability);
    document.getElementById('closeCreateAvailabilityModal').addEventListener('click', hideCreateAvailabilityModal);
    
    // Request modal
    document.getElementById('closeRequestModal').addEventListener('click', hideRequestModal);
}

function switchView(view) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.tab[data-view="${view}"]`).classList.add('active');
    
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`${view}View`).classList.remove('hidden');
    
    if (view === 'clients') {
        loadClients();
    } else if (view === 'requests') {
        loadAllRequests();
    } else if (view === 'appointments') {
        loadAppointments();
    }
}

async function loadCalendarData() {
    try {
        // Load timeslots
        const timeslotsRes = await fetch(`${SERV_ADDRESS}/api/hoster/${state.hoster.id}/timeslots`);
        const timeslotsData = await timeslotsRes.json();
        if (timeslotsData.success) {
            state.timeslots = timeslotsData.timeslots;
        }
        
        // Load appointments
        const appointmentsRes = await fetch(`${SERV_ADDRESS}/api/hoster/${state.hoster.id}/appointments`);
        const appointmentsData = await appointmentsRes.json();
        if (appointmentsData.success) {
            state.appointments = appointmentsData.appointments;
        }
        
        renderCalendarEvents();
    } catch (error) {
        console.error('Failed to load calendar data:', error);
    }
}

function showCreateAvailabilityModal(start, end) {
    const modal = document.getElementById('createAvailabilityModal');
    document.getElementById('selectedTimeRange').textContent = 
        `${formatDateTime(start)} - ${formatDateTime(end)}`;
    modal.dataset.start = start.toISOString();
    modal.dataset.end = end.toISOString();
    modal.classList.remove('hidden');
}

function hideCreateAvailabilityModal() {
    document.getElementById('createAvailabilityModal').classList.add('hidden');
}

async function handleCreateAvailability() {
    const modal = document.getElementById('createAvailabilityModal');
    const start = modal.dataset.start;
    const end = modal.dataset.end;
    
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/timeslots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hosterId: state.hoster.id,
                startTime: start,
                endTime: end
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideCreateAvailabilityModal();
            loadCalendarData();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to create availability: ' + error.message);
    }
}

function showAddClientModal() {
    document.getElementById('addClientModal').classList.remove('hidden');
}

function hideAddClientModal() {
    document.getElementById('addClientModal').classList.add('hidden');
    document.getElementById('clientSearch').value = '';
    document.getElementById('newClientName').value = '';
    document.getElementById('clientSearchResults').innerHTML = '';
}

async function handleClientSearch(e) {
    const query = e.target.value;
    
    if (query.length < 2) {
        document.getElementById('clientSearchResults').innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/clients/search?name=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.success) {
            const results = document.getElementById('clientSearchResults');
            results.innerHTML = '';
            
            data.clients.forEach(client => {
                const item = document.createElement('div');
                item.className = 'client-search-item';
                item.textContent = client.name;
                item.addEventListener('click', () => connectClient(client.id));
                results.appendChild(item);
            });
        }
    } catch (error) {
        console.error('Search failed:', error);
    }
}

async function handleCreateClient() {
    const name = document.getElementById('newClientName').value.trim();
    
    if (!name) {
        alert('Please enter a client name');
        return;
    }
    
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/clients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        
        if (data.success) {
            connectClient(data.client.id);
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to create client: ' + error.message);
    }
}

async function connectClient(clientId) {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/clients/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hosterId: state.hoster.id,
                clientId: clientId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`Client added! Share this link: ${window.location.origin}?connectionId=${data.connection.connection_id}`);
            hideAddClientModal();
            loadClients();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to connect client: ' + error.message);
    }
}

async function loadClients() {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/${state.hoster.id}/clients`);
        const data = await response.json();
        
        if (data.success) {
            state.clients = data.clients;
            renderClients();
        }
    } catch (error) {
        console.error('Failed to load clients:', error);
    }
}

function renderClients() {
    const list = document.getElementById('clientsList');
    list.innerHTML = '';
    
    if (state.clients.length === 0) {
        list.innerHTML = '<p>No clients yet. Click "Add Client" to get started.</p>';
        return;
    }
    
    state.clients.forEach(client => {
        const item = document.createElement('div');
        item.className = 'list-item';
        
        const link = `${window.location.origin}?connectionId=${client.connection_id}`;
        
        item.innerHTML = `
            <h3>${client.client_name}</h3>
            <p>Link: <a href="${link}" target="_blank">${link}</a></p>
            <button onclick="copyToClipboard('${link}')">Copy Link</button>
        `;
        
        list.appendChild(item);
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Link copied to clipboard!');
    });
}

async function showTimeslotRequests(timeslotId) {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/timeslots/${timeslotId}/requests`);
        const data = await response.json();
        
        if (data.success) {
            renderRequestsModal(data.requests, timeslotId);
        }
    } catch (error) {
        console.error('Failed to load requests:', error);
    }
}

function renderRequestsModal(requests, timeslotId) {
    const modal = document.getElementById('requestModal');
    const list = document.getElementById('requestsList');
    
    list.innerHTML = '';
    
    if (requests.length === 0) {
        list.innerHTML = '<p>No requests for this time slot.</p>';
    } else {
        requests.forEach(request => {
            const item = document.createElement('div');
            item.className = 'list-item';
            
            item.innerHTML = `
                <h3>${request.client_name}</h3>
                <p>${formatDateTime(request.start_time)} - ${formatDateTime(request.end_time)}</p>
                <p><span class="preference-badge">Preference: ${request.preference}</span></p>
                ${request.validated_by_hoster ? '<p><span class="validated-badge">Validated</span></p>' : ''}
                ${!request.validated_by_hoster ? 
                    `<button class="success" onclick="validateRequest(${request.id})">Validate</button>` :
                    `<button class="danger" onclick="unvalidateRequest(${request.id})">Cancel Validation</button>`
                }
            `;
            
            list.appendChild(item);
        });
    }
    
    // Add delete availability button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger';
    deleteBtn.textContent = 'Delete Availability Block';
    deleteBtn.onclick = () => deleteTimeslot(timeslotId);
    list.appendChild(deleteBtn);
    
    modal.classList.remove('hidden');
}

function hideRequestModal() {
    document.getElementById('requestModal').classList.add('hidden');
}

async function validateRequest(requestId) {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/requests/${requestId}/validate`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideRequestModal();
            loadCalendarData();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to validate request: ' + error.message);
    }
}

async function unvalidateRequest(requestId) {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/requests/${requestId}/unvalidate`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideRequestModal();
            loadCalendarData();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to cancel validation: ' + error.message);
    }
}

async function deleteTimeslot(timeslotId) {
    if (!confirm('Are you sure? This will delete all requests and appointments for this time slot.')) {
        return;
    }
    
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/timeslots/${timeslotId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideRequestModal();
            loadCalendarData();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to delete timeslot: ' + error.message);
    }
}

async function loadAllRequests() {
    // This would show all requests across all timeslots
    const list = document.getElementById('myRequestsList');
    list.innerHTML = '<p>View requests by clicking on availability blocks in the calendar.</p>';
}

async function loadAppointments() {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/hoster/${state.hoster.id}/appointments`);
        const data = await response.json();
        
        if (data.success) {
            renderAppointmentsList(data.appointments);
        }
    } catch (error) {
        console.error('Failed to load appointments:', error);
    }
}

function renderAppointmentsList(appointments) {
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
            <h3>${appt.client_name}</h3>
            <p>${formatDateTime(appt.start_time)} - ${formatDateTime(appt.end_time)}</p>
            <p>${appt.done ? '<span class="validated-badge">Done</span>' : ''}</p>
        `;
        
        list.appendChild(item);
    });
}