# Smart Plant Monitoring System

A comprehensive IoT-based solution for automated plant monitoring and care using ESP32, environmental sensors, machine learning, and a web interface.


## Overview

The Smart Plant Monitoring System automates plant care through continuous monitoring of environmental conditions and autonomous control of plant maintenance devices. The system collects real-time data on soil moisture, temperature, humidity, and light intensity, processes this information, and automatically activates water pumps, humidifiers, and cooling fans as needed to maintain optimal growing conditions.

## Key Features

- **Real-time Environmental Monitoring**: Tracks soil moisture, temperature, humidity, and light intensity
- **Automated Plant Care**: Controls water pumps, cooling fans, and humidifiers based on sensor readings
- **Machine Learning Predictions**: Evaluates plant health status using XGBoost model
- **Web Interface**: Visualizes sensor data, actuator states, and system logs
- **Mobile Control**: Override automatic controls through Blynk mobile app
- **WebSocket Communication**: Provides real-time updates and remote control capability

## System Architecture

### Hardware Components
- ESP32 microcontroller
- DHT22 temperature and humidity sensor
- Soil moisture sensor
- Light-dependent resistor (LDR)
- Water pump (relay-controlled)
- Stepper motors for fan and humidifier
- LED indicator

### Software Components
- **Backend**: Flask web server with SocketIO for real-time communication
- **Database**: MySQL for data storage
- **Machine Learning**: XGBoost model for plant health prediction
- **Frontend**: HTML, CSS, JavaScript with real-time data visualization
- **IoT Control**: Arduino code for ESP32 with Blynk integration

## Directory Structure

```
web_server_plant_monitoring/
|-- static/
|   |-- css/
|   |   |-- style.css
|   |-- js/
|       |-- log_script.js
|       |-- predictions.js
|       |-- script.js
|-- templates/
|   |-- index.html
|   |-- logs.html
|   |-- predictions.html
|-- utils/
|   |-- __init__.py
|   |-- config.py
|   |-- database.py
|   |-- models.py
|   |-- sensor.py
|-- .env
|-- app.py
|-- requirements.txt
|-- README.md
|-- arduino.c
|-- xgboost_plant_health.pkl
```

## Installation and Setup

### Server Requirements
```
pip install -r requirements.txt
```

Key dependencies:
- Flask
- Flask-SocketIO
- PyMySQL
- NumPy
- eventlet
- scikit-learn
- xgboost

### Database Setup
1. Create a MySQL database
2. Configure database credentials in `.env` file:
```
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=plant_monitoring
```

### ESP32 Setup
1. Install required libraries in Arduino IDE:
   - Blynk
   - DHT sensor library
   - AccelStepper
   - ArduinoJson
   - WebSocketsClient
2. Update WiFi credentials and Blynk authentication token
3. Configure the ngrok URL for server communication

## Usage

### Starting the Server
```
python app.py
```
The server will run on port 5000 by default.

### Web Interface
- **Dashboard**: `/` - Main interface showing current readings and controls
- **Logs**: `/logs` - Historical sensor data and actuator states
- **Predictions**: `/predictions` - Plant health prediction history

### API Endpoints
- `POST /api/sensor_data` - Log sensor data and get actuator states
- `GET/POST /api/actuator` - Get or control actuator states
- `GET /api/logs` - Retrieve historical sensor data
- `GET /api/latest` - Get latest sensor readings
- `GET /api/predict` - Get plant health prediction
- `GET /api/prediction_history` - Retrieve prediction history
- `GET /api/sensor_history` - Get historical sensor data for charts

## Machine Learning Model

The system uses an XGBoost classifier to predict plant health status based on:
- Soil moisture level
- Temperature
- Humidity
- Light intensity

The model categorizes plant health as:
- "Healthy"
- "Moderate Stress"
- "Heavy Stress"

## WebSocket Integration

The system uses WebSockets to provide real-time updates to the web interface. Key events include:
- `sensor_update` - New sensor readings
- `actuator_update` - Changes in actuator states

## Threshold Settings

Default thresholds for automated control:
- **Soil Moisture**: < 30% triggers watering
- **Temperature**: > 35°C activates cooling fan
- **Humidity**: < 40% activates humidifier
- **Light Intensity**: > 1560 sends low light alert

These thresholds can be adjusted in the `config.py` file.

## Troubleshooting

### Common Issues
- **Database Connection Errors**: Verify database credentials in `.env` file
- **Sensor Reading Failures**: Check sensor connections and power supply
- **WebSocket Disconnections**: Ensure server is accessible through the configured URL
- **ESP32 Connectivity Issues**: Verify WiFi signal strength and credentials

### Logs
Check server logs for detailed error messages and system status.



## License

[MIT License](LICENSE)