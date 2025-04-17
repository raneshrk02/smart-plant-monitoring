document.addEventListener("DOMContentLoaded", () => {
    getCurrentPrediction();    
    setInterval(getCurrentPrediction, 5000);
});

const NGROK_BASE_URL = 'https://url.ngrok-free.app';

async function getCurrentPrediction() {
    try {
        const response = await fetch(`${NGROK_BASE_URL}/api/predict`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            mode: 'cors',
            credentials: 'omit'
        });

        const responseText = await response.text();
        console.log('Raw response:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse JSON:', parseError);
            throw new Error('Invalid JSON response from server');
        }
        
        if (data.error) {
            console.error('Prediction error:', data.error);
            document.getElementById('currentPrediction').innerHTML = `
                <div class="prediction-value error">
                    Error: ${data.error}
                </div>
            `;
            return;
        }
        
        document.getElementById('lastPredictionUpdate').textContent = 
            `Last Updated: ${data.timestamp}`;
        
        const predictionDiv = document.getElementById('currentPrediction');
        predictionDiv.innerHTML = `
            <div class="prediction-value ${data.prediction.toLowerCase().replace(' ', '-')}">
                Plant Status: ${data.prediction}
            </div>
        `;
        
        if (data.probabilities) {
            document.getElementById('predictionConfidence').textContent = 
                `Confidence: ${(Math.max(...data.probabilities) * 100).toFixed(2)}%`;
        }
        
        updateFeatureChart(data.features);
    } catch (error) {
        console.error('Error fetching prediction:', error);
        document.getElementById('currentPrediction').innerHTML = `
            <div class="prediction-value error">
                Error fetching prediction: ${error.message}
            </div>
        `;
    }
}

async function loadPredictionHistory() {
    try {
        const response = await fetch(`${NGROK_BASE_URL}/api/prediction_history`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data || data.length === 0) {
            console.log('No prediction history data available');
            return;
        }

        const timestamps = data.map(d => d.timestamp);
        const predictions = data.map(d => d.prediction);
        
        const trace = {
            x: timestamps,
            y: predictions,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Plant Health'
        };
        
        const layout = {
            title: 'Plant Health Prediction History',
            xaxis: { title: 'Time' },
            yaxis: { title: 'Predicted Health Status' }
        };
        
        Plotly.newPlot('predictionChart', [trace], layout);
    } catch (error) {
        console.error('Error loading prediction history:', error);
        document.getElementById('predictionChart').innerHTML = `
            <div class="error-message">
                Error loading prediction history: ${error.message}
            </div>
        `;
    }
}

function updateFeatureChart(features) {
    const thresholds = {
        'soil_moisture': 30,    
        'temperature': 35,      
        'humidity': 40,         
        'light_intensity': 1560 
    };

    const barTrace = {
        x: Object.keys(features),
        y: Object.values(features),
        type: 'bar',
        name: 'Current Values',
        marker: {
            color: ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f']
        }
    };

    const thresholdTraces = Object.keys(features).map((sensor, index) => ({
        x: [sensor, sensor],
        y: [0, thresholds[sensor]],
        type: 'scatter',
        mode: 'lines',
        name: `${sensor.replace('_', ' ')} threshold`,
        line: {
            color: 'red',
            width: 2,
            dash: 'dash'
        },
        showlegend: true
    }));

    const layout = {
        title: 'Current Sensor Values with Thresholds',
        xaxis: { 
            title: 'Sensor',
            tickangle: -45
        },
        yaxis: { title: 'Value' },
        margin: { 
            b: 100,  
            l: 80,   
            r: 50,   
            t: 50    
        },
        legend: {
            orientation: 'h',     
            y: -0.3,             
            x: 0.5,              
            xanchor: 'center'    
        },
        annotations: Object.keys(features).map((sensor, index) => ({
            x: sensor,
            y: thresholds[sensor],
            xref: 'x',
            yref: 'y',
            text: `Threshold: ${thresholds[sensor]}`,
            showarrow: true,
            arrowhead: 2,
            arrowsize: 1,
            arrowwidth: 1,
            ax: -30,
            ay: -30
        }))
    };

    const traces = [barTrace, ...thresholdTraces];
    
    Plotly.newPlot('featureChart', traces, layout);

    const chartElement = document.getElementById('featureChart');
    chartElement.on('plotly_click', function(data) {
        const sensorName = data.points[0].x;
        const sensorValue = data.points[0].y;
        const threshold = thresholds[sensorName];
        
        let status = '';
        if (sensorName === 'soil_moisture' || sensorName === 'humidity') {
            status = sensorValue < threshold ? 'Below threshold!' : 'Normal';
        } else {
            status = sensorValue > threshold ? 'Above threshold!' : 'Normal';
        }

        const annotation = {
            text: `Value: ${sensorValue}<br>Threshold: ${threshold}<br>Status: ${status}`,
            x: sensorName,
            y: sensorValue,
            showarrow: true,
            arrowhead: 2,
            ax: 0,
            ay: -40
        };

        Plotly.relayout(chartElement, {annotations: [annotation]});
    });
}

function goToDashboard() {
    window.location.href = '/';
}

async function loadHistoryChart() {
    try {
        const response = await fetch(`${NGROK_BASE_URL}/api/logs`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            mode: 'cors'
        });

        const data = await response.json();
        const logs = data.logs;

        const traces = [
            {
                x: logs.map(log => log.timestamp),
                y: logs.map(log => log.temperature),
                name: 'Temperature',
                type: 'scatter',
                line: { color: '#e74c3c' }
            },
            {
                x: logs.map(log => log.timestamp),
                y: logs.map(log => log.humidity),
                name: 'Humidity',
                type: 'scatter',
                line: { color: '#3498db' }
            },
            {
                x: logs.map(log => log.timestamp),
                y: logs.map(log => log.soil_moisture),
                name: 'Soil Moisture',
                type: 'scatter',
                line: { color: '#2ecc71' }
            },
            {
                x: logs.map(log => log.timestamp),
                y: logs.map(log => log.light_value),
                name: 'Light',
                type: 'scatter',
                line: { color: '#f1c40f' }
            }
        ];

        const layout = {
            title: 'Sensor Values Over Time',
            xaxis: { title: 'Time' },
            yaxis: { title: 'Value' },
            legend: { orientation: 'h', y: -0.2 }
        };

        Plotly.newPlot('historyChart', traces, layout);
    } catch (error) {
        console.error('Error loading history chart:', error);
    }
}

async function loadHealthDistribution() {
    try {
        const response = await fetch(`${NGROK_BASE_URL}/api/prediction_history`, {
            headers: {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': true
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Health Distribution Error Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Health Distribution Data:', data);
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('No prediction data available');
        }
        
        const statusCounts = {
            'Healthy': 0,
            'Moderate Stress': 0,
            'High Stress': 0
        };
        
        data.forEach(record => {
            if (record.prediction in statusCounts) {
                statusCounts[record.prediction]++;
            }
        });
        
        const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
        if (total === 0) {
            throw new Error('No valid prediction data available');
        }
        
        const plotData = [{
            values: Object.values(statusCounts),
            labels: Object.keys(statusCounts),
            type: 'pie',
            marker: {
                colors: ['#27ae60', '#f39c12', '#e74c3c']
            }
        }];
        
        const layout = {
            title: 'Plant Health Status Distribution',
            height: 400,
            showlegend: true
        };
        
        Plotly.newPlot('healthDistribution', plotData, layout);
    } catch (error) {
        console.error('Error loading health distribution:', error);
        document.getElementById('healthDistribution').innerHTML = 
            `<div class="error-message">Error loading health distribution data: ${error.message}</div>`;
    }
}

async function createCorrelationChart() {
    try {
        const response = await fetch(`${NGROK_BASE_URL}/api/sensor_history`, {
            headers: {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': true
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Correlation Data Error Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Correlation Data:', data);
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('No sensor data available');
        }
        
        const temperature = data.map(d => Number(d.temperature));
        const humidity = data.map(d => Number(d.humidity));
        const soilMoisture = data.map(d => Number(d.soil_moisture));
        const light = data.map(d => Number(d.light));
        
        if (temperature.some(isNaN) || humidity.some(isNaN) || 
            soilMoisture.some(isNaN) || light.some(isNaN)) {
            throw new Error('Invalid sensor data values');
        }
        
        const parameters = ['Temperature', 'Humidity', 'Soil Moisture', 'Light'];
        const values = [temperature, humidity, soilMoisture, light];
        const correlationMatrix = [];
        
        for (let i = 0; i < values.length; i++) {
            correlationMatrix[i] = [];
            for (let j = 0; j < values.length; j++) {
                correlationMatrix[i][j] = calculateCorrelation(values[i], values[j]);
            }
        }
        
        const plotData = [{
            z: correlationMatrix,
            x: parameters,
            y: parameters,
            type: 'heatmap',
            colorscale: 'RdBu',
            zmin: -1,
            zmax: 1
        }];
        
        const layout = {
            title: 'Parameter Correlation Matrix',
            height: 400,
            xaxis: {
                title: 'Parameters'
            },
            yaxis: {
                title: 'Parameters'
            }
        };
        
        Plotly.newPlot('correlationMatrix', plotData, layout);
    } catch (error) {
        console.error('Error creating correlation chart:', error);
        document.getElementById('correlationMatrix').innerHTML = 
            `<div class="error-message">Error loading correlation data: ${error.message}</div>`;
    }
}

function calculateCorrelation(x, y) {
    const n = x.length;
    let sum_x = 0;
    let sum_y = 0;
    let sum_xy = 0;
    let sum_x2 = 0;
    let sum_y2 = 0;
    
    for (let i = 0; i < n; i++) {
        sum_x += x[i];
        sum_y += y[i];
        sum_xy += x[i] * y[i];
        sum_x2 += x[i] * x[i];
        sum_y2 += y[i] * y[i];
    }
    
    const numerator = (n * sum_xy) - (sum_x * sum_y);
    const denominator = Math.sqrt(
        ((n * sum_x2) - (sum_x * sum_x)) *
        ((n * sum_y2) - (sum_y * sum_y))
    );
    
    return denominator === 0 ? 0 : numerator / denominator;
}

document.addEventListener("DOMContentLoaded", () => {
    getCurrentPrediction();
    loadHistoryChart();
    loadHealthDistribution();
    createCorrelationChart();
    
    setInterval(() => {
        getCurrentPrediction();
        loadHistoryChart();
        loadHealthDistribution();
        createCorrelationChart();
    }, 30000); 
});
