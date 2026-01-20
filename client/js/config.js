const SERV_ADDRESS = "http://localhost:3000";

const state = {
    userType: null, // 'hoster' or 'client'
    hoster: null,
    connectionId: null,
    connection: null,
    currentWeekStart: null,
    timeslots: [],
    requests: [],
    appointments: [],
    clients: [],
    selectedCells: [],
    isSelecting: false,
    selectionStart: null
};

function getTimeSlots() {
    const slots = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            slots.push({ hour, minute });
        }
    }
    return slots;
}

function formatTime(hour, minute) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatDate(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return `${formatDate(date)} ${formatTime(date.getHours(), date.getMinutes())}`;
}

function roundToQuarterHour(date) {
    const minutes = date.getMinutes();
    const rounded = Math.floor(minutes / 15) * 15;
    date.setMinutes(rounded);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
}