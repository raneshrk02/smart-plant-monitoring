document.addEventListener("DOMContentLoaded", () => {
    const socket = io('https://f771-223-187-123-96.ngrok-free.app', {
        transports: ['websocket', 'polling'],
        secure: true,
        rejectUnauthorized: false,
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
    });
    
    fetchLogs();

    socket.on('sensor_update', () => {
        fetchLogs();
    });

    socket.on('connect', () => {
        console.log('Connected to server');
        showAlert('Connected to server', 'success');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showAlert('Connection lost', 'error');
    });
});

function showAlert(message, type = 'info') {
    let alertsContainer = document.getElementById('alerts-container');
    if (!alertsContainer) {
        alertsContainer = document.createElement('div');
        alertsContainer.id = 'alerts-container';
        document.body.appendChild(alertsContainer);
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'alert-close';
    closeButton.textContent = '×';
    closeButton.onclick = () => alert.remove();

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    alert.appendChild(closeButton);
    alert.appendChild(messageSpan);

    alertsContainer.appendChild(alert);

    setTimeout(() => alert.classList.add('alert-visible'), 10);

    setTimeout(() => {
        alert.classList.add('alert-hiding');
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

let currentPage = 1;
const logsPerPage = 10;

async function fetchLogs() {
    try {
        const response = await fetch(`/api/logs?page=${currentPage}&limit=${logsPerPage}`);
        const data = await response.json();
        
        if (data.error) {
            showAlert('Error fetching logs');
            return;
        }

        const tableBody = document.getElementById("logsTableBody");
        tableBody.innerHTML = "";

        if (data.logs.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6">No logs available for this page.</td></tr>`;
        } else {
            data.logs.forEach(log => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                    <td>${log.temperature}°C</td>
                    <td>${log.humidity}%</td>
                    <td>${log.soil_moisture}%</td>
                    <td>${log.light_value}</td>
                    <td>Water Pump: ${log.water_pump ? 'ON' : 'OFF'}, 
                        Humidifier: ${log.humidifier ? 'ON' : 'OFF'}, 
                        Cooling Fan: ${log.cooling_fan ? 'ON' : 'OFF'}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        updatePagination(data.total_records);
    } catch (error) {
        console.warn("Error fetching logs: ", error);
        showAlert("Failed to fetch logs");
    }
}

function updatePagination(totalLogs) {
    const totalPages = Math.ceil(totalLogs / logsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

function changePage(delta) {
    const totalPages = Math.ceil(totalLogs / logsPerPage);
    currentPage = Math.max(1, Math.min(currentPage + delta, totalPages));
    fetchLogs();
}

function goToDashboard() {
    window.location.href = '/';
}