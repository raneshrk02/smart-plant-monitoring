const NGROK_BASE_URL = 'https://f771-223-187-123-96.ngrok-free.app';

document.addEventListener("DOMContentLoaded", () => {
    const alertsContainer = document.createElement('div');
    alertsContainer.id = 'alerts-container';
    document.body.appendChild(alertsContainer);
    
    let initialDataLoaded = false;
    
    const socket = io(`${NGROK_BASE_URL}`, {
        transports: ['websocket'],
        secure: true,
        rejectUnauthorized: false,
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true,
        autoConnect: true,
        query: {
            EIO: "4"
        }
    });

    fetchActuatorStates();

    async function fetchLatestData() {
        try {
            console.log(`Fetching data from: ${NGROK_BASE_URL}/api/latest`);
            const response = await fetch(`${NGROK_BASE_URL}/api/latest`, {
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            
            console.log(`Response status: ${response.status}`);
            console.log(`Response type: ${response.headers.get('content-type')}`);
            
            if (!response.ok) {
                const text = await response.text();
                console.error('Error response:', text.substring(0, 200) + '...');
                showAlert(`API Error: ${response.status}`, 'error');
                return;
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text.substring(0, 200) + '...');
                showAlert('Invalid response format', 'error');
                return;
            }
            
            const data = await response.json();
            if (data && data.length > 0) {
                console.log('Fetched latest data:', data[0]);
                updateData(data[0]);
                checkThresholds(data[0]);
                initialDataLoaded = true;
            }
        } catch (error) {
            console.error('Error fetching latest data:', error);
            showAlert(`Connection error: ${error.message}`, 'error');
        }
    }

    async function fetchActuatorStates() {
        try {
            console.log(`Fetching actuator states from: ${NGROK_BASE_URL}/api/actuator`);
            const response = await fetch(`${NGROK_BASE_URL}/api/actuator`, {
                headers: {
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            
            if (!response.ok) {
                console.error(`Failed to fetch actuator states: ${response.status}`);
                return;
            }
            
            const data = await response.json();
            console.log('Fetched actuator states:', data);
            
            actuatorStates.water_pump = Boolean(data.water_pump);
            actuatorStates.humidifier = Boolean(data.humidifier);
            actuatorStates.cooling_fan = Boolean(data.cooling_fan);
            
            updateActuatorIndicators();
        } catch (error) {
            console.error('Error fetching actuator states:', error);
        }
    }

    fetchLatestData();
    
    const updateInterval = setInterval(fetchLatestData, 5000);

    window.addEventListener('beforeunload', () => {
        clearInterval(updateInterval);
    });

    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        showAlert('Connected to server', 'success');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showAlert('Connection error: ' + error.message, 'error');
    });

    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server:', reason);
        showAlert('Connection lost: ' + reason, 'error');
    });

    socket.on('sensor_update', (data) => {
        console.log('Received sensor update:', data);
        if (data) {
            updateData(data);
            checkThresholds(data);  
        }
    });

    socket.on('actuator_update', (data) => {
        console.log('Received actuator update:', data);
        if (data && data.actuator) {
            actuatorStates[data.actuator] = Boolean(data.state);
            updateActuatorIndicators();
        }
    });
});

const actuatorStates = {
    water_pump: false,
    humidifier: false,
    cooling_fan: false,
};

function updateData(data) {
    const timestamp = new Date(data.timestamp).toLocaleString();
    setElementText("lastUpdate", `Last Updated: ${timestamp}`);
    
    setElementText("soilMoisture", `${data.soil_moisture || 0}%`);
    setElementText("temperature", `${data.temperature || 0}°C`);
    setElementText("humidity", `${data.humidity || 0}%`);
    setElementText("light", `${data.light_value || 0} lux`);
}

function checkThresholds(data) {
    const thresholds = {
        soil_moisture: 30,
        temperature: 35,
        humidity: 40,
        light: 1560
    };

    let updatedStates = {
        water_pump: false,
        cooling_fan: false,
        humidifier: false
    };

    if (data.soil_moisture < thresholds.soil_moisture) {
        updatedStates.water_pump = true;
        showAlert('Low soil moisture detected! Watering system activated.');
    }

    if (data.temperature > thresholds.temperature) {
        updatedStates.cooling_fan = true;
        showAlert('High temperature detected! Cooling fan activated.');
    }

    if (data.humidity < thresholds.humidity) {
        updatedStates.humidifier = true;
        showAlert('Low humidity detected! Humidifier activated.');
    }

    if (data.light_value > thresholds.light || data.light_value == 0) {
        showAlert('Low light levels detected!');
    }

    console.log('Threshold check:', {
        soil_moisture: data.soil_moisture,
        threshold: thresholds.soil_moisture,
        water_pump_state: actuatorStates.water_pump
    });
}

async function toggleActuator(actuator) {
    console.log(`Attempting to toggle ${actuator}`);
    
    if (!actuator) {
        console.error('No actuator specified');
        showAlert('Error: No actuator specified', 'error');
        return;
    }
    
    try {
        const newState = !actuatorStates[actuator];
        console.log(`Setting ${actuator} to ${newState}`);
        
        const response = await fetch(`${NGROK_BASE_URL}/api/actuator`, {  
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ actuator, state: newState ? 1 : 0 }),
        });
                
        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Server error (${response.status}):`, errorText);
            showAlert(`Server error: ${response.status}`, 'error');
            return;
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        actuatorStates[actuator] = newState;
        updateActuatorIndicators();
        showAlert(`${actuator.replace('_', ' ')} ${newState ? 'activated' : 'deactivated'}`);
    } catch (error) {
        console.error('Error toggling actuator:', error);
        showAlert(`Failed to toggle ${actuator}: ${error.message}`, 'error');
    }
}

function updateActuatorIndicators() {
    console.log("Current actuator states:", actuatorStates);
    
    Object.entries(actuatorStates).forEach(([actuator, state]) => {
        console.log(`Updating ${actuator} to ${state ? 'ON' : 'OFF'}`);
        
        const statusElement = document.getElementById(`${actuator}Status`);
        const buttonElement = document.getElementById(`${actuator}Btn`);
        
        if (!statusElement) {
            console.error(`Status element not found for: ${actuator}Status`);
        }
        
        if (!buttonElement) {
            console.error(`Button element not found for: ${actuator}Btn`);
        }
        
        if (statusElement) {
            statusElement.className = `status-indicator ${state ? 'status-on' : 'status-off'}`;
        }
        
        if (buttonElement) {
            buttonElement.className = state ? 'active' : '';
        }
    });
}

function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`Element with id "${elementId}" not found.`);
    }
}

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

function goToLogs() {
    window.location.href = '/logs';
}

function goToPredictions() {
    window.location.href = '/predictions';
}

window.toggleActuator = toggleActuator;