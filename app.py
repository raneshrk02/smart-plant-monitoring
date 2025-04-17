import eventlet #type: ignore
eventlet.monkey_patch()

import logging
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, render_template, make_response #type: ignore
import pymysql #type: ignore
from flask_cors import CORS #type: ignore
from flask_socketio import SocketIO, emit #type: ignore
from werkzeug.middleware.proxy_fix import ProxyFix #type: ignore
import numpy as np

from utils.config import Config
from utils.database import DatabaseManager
from utils.sensor import SensorData
from utils.models import load_model, predict_plant_health

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.app_context().push()

CORS(app, resources={
    r"/*": {
        "origins": ["https://f771-223-187-123-96.ngrok-free.app", "*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Accept", "ngrok-skip-browser-warning"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})
socketio = SocketIO(app, cors_allowed_origins="*")

app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

model = load_model()

def handle_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in {f.__name__}: {str(e)}")
            return jsonify({"error": str(e)}), 500
    return decorated_function

@app.before_request
def log_request_info():
    logger.info(f"Request Headers: {dict(request.headers)}")
    if request.method != 'OPTIONS' and request.content_length:
        logger.info(f"Request Body: {request.get_data().decode()}")
    
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/logs')
def logs():
    return render_template('logs.html')

@app.route('/predictions')
def predictions():
    return render_template('predictions.html')

@app.route('/api/sensor_data', methods=['POST'])
@handle_errors
def log_sensor_data():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data received"}), 400
        
        required_fields = ['temperature', 'humidity', 'soil_moisture', 'light']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({"error": f"Missing required fields: {missing_fields}"}), 400

        actuator_states = SensorData.check_thresholds(data)
        
        SensorData.log_data(data, socketio)

        return jsonify({
            "status": "success",
            "actuator_states": actuator_states
        })
    except Exception as e:
        logger.error(f"Error processing sensor data: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/actuator', methods=['POST', 'OPTIONS'])
@handle_errors
def control_actuator():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data received"}), 400
            
        actuator = data.get('actuator')
        state = data.get('state')

        logger.info(f"Actuator control request: {actuator}={state}")
        
        if actuator not in Config.VALID_ACTUATORS:
            return jsonify({"error": f"Invalid actuator. Valid options are: {Config.VALID_ACTUATORS}"}), 400

        # Convert state to boolean for consistent storage
        state_bool = bool(state)
        
        query = f"UPDATE actuator_state SET {actuator} = %s WHERE id = 1"
        DatabaseManager.execute_query(query, (state_bool,))

        # Broadcast the change to all connected clients
        socketio.emit('actuator_update', {"actuator": actuator, "state": state_bool})
        
        return jsonify({
            "success": True,
            "message": f"Actuator {actuator} state changed to {state_bool}"
        }), 200
    except Exception as e:
        logger.error(f"Error in control_actuator: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/actuator', methods=['GET'])
@handle_errors
def get_actuator_states():
    query = """
        SELECT water_pump, humidifier, cooling_fan FROM actuator_state WHERE id = 1
    """
    data = DatabaseManager.execute_query(query)
    if not data:
        return jsonify({
            "water_pump": False,
            "humidifier": False,
            "cooling_fan": False
        })
    return jsonify({
        "water_pump": bool(data[0].get("water_pump", False)),
        "humidifier": bool(data[0].get("humidifier", False)),
        "cooling_fan": bool(data[0].get("cooling_fan", False))
    })

@app.route('/api/logs', methods=['GET'])
@handle_errors
def get_logs():
    page = request.args.get('page', default=1, type=int)
    limit = request.args.get('limit', default=10, type=int)

    if page <= 0 or limit <= 0:
        return jsonify({"error": "Invalid page or limit"}), 400

    offset = (page - 1) * limit

    count_query = "SELECT COUNT(*) as total FROM sensor_data"
    total_records = DatabaseManager.execute_query(count_query)[0]['total']
    total_pages = (total_records + limit - 1) // limit 

    query = """
        SELECT timestamp, temperature, humidity, soil_moisture, light_value, water_pump, humidifier, cooling_fan
        FROM sensor_data ORDER BY timestamp DESC LIMIT %s OFFSET %s
    """
    logs = DatabaseManager.execute_query(query, (limit, offset))

    for log in logs:
        log['timestamp'] = log['timestamp'].strftime('%Y-%m-%d %H:%M:%S')  

    return jsonify({
        "logs": logs,
        "page": page,
        "limit": limit,
        "total_records": total_records,
        "total_pages": total_pages  
    })

@app.route('/api/latest', methods=['GET'])
@handle_errors
def get_recent_data():
    query = """
        SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 1
    """
    data = DatabaseManager.execute_query(query)
    if not data:
        return jsonify([])
    return jsonify([{
        "timestamp": row["timestamp"].strftime('%Y-%m-%d %H:%M:%S'),
        "temperature": row.get("temperature", 0.0),
        "humidity": row.get("humidity", 0.0),
        "soil_moisture": row.get("soil_moisture", 0),
        "light_value": row.get("light_value", 0),
        "water_pump": bool(row.get("water_pump", False)),
        "humidifier": bool(row.get("humidifier", False)),
        "cooling_fan": bool(row.get("cooling_fan", False))
    } for row in data])

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client connected with ID: {request.sid}')
    query = "SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 1"
    latest_data = DatabaseManager.execute_query(query)
    if latest_data:
        latest_data[0]['timestamp'] = latest_data[0]['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
        emit('sensor_update', latest_data[0])

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f'Client disconnected: {request.sid}')

@socketio.on('ping')
def handle_ping():
    emit('pong')

@app.route('/api/predict', methods=['GET', 'OPTIONS'])
@handle_errors
def get_prediction():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,ngrok-skip-browser-warning')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        return response

    if model is None:
        return jsonify({"error": "ML model not loaded"}), 500
        
    try:
        query = """
            SELECT id, soil_moisture, temperature, humidity, light_value FROM sensor_data ORDER BY timestamp DESC LIMIT 1
        """
        data = DatabaseManager.execute_query(query)
        
        if not data:
            return jsonify({"error": "No sensor data available"}), 404
        
        features = np.array([[
            data[0]['soil_moisture'],
            data[0]['temperature'],
            data[0]['humidity'],
            data[0]['light_value']
        ]])
        
        try:
            prediction_status = predict_plant_health(model, features)
            
            store_query = """
                INSERT INTO predictions (prediction, sensor_data_id) VALUES (%s, %s)
            """
            DatabaseManager.execute_query(store_query, (prediction_status, data[0]['id']))
            
            response = jsonify({
                "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                "prediction": prediction_status,
                "features": {
                    "soil_moisture": data[0]['soil_moisture'],
                    "temperature": data[0]['temperature'],
                    "humidity": data[0]['humidity'],
                    "light_intensity": data[0]['light_value']
                }
            })
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            return jsonify({"error": f"Prediction failed: {str(e)}"}), 500
            
    except Exception as e:
        logger.error(f"Error in get_prediction: {str(e)}")
        return jsonify({"error": f"Error: {str(e)}"}), 500

@app.route('/api/prediction_history', methods=['GET'])
@handle_errors
def get_prediction_history():
    try:
        query = """
            SELECT prediction, timestamp FROM predictions ORDER BY timestamp DESC LIMIT 100
        """
        predictions = DatabaseManager.execute_query(query)
        
        if not predictions:
            return jsonify([])
            
        result = [{
            'prediction': row['prediction'],
            'timestamp': row['timestamp'].isoformat() if row['timestamp'] else None
        } for row in predictions]
        
        status_counts = {}
        for row in result:
            status = row['prediction']
            status_counts[status] = status_counts.get(status, 0) + 1
        logger.info(f"ML Prediction distribution: {status_counts}")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in get_prediction_history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sensor_history', methods=['GET'])
@handle_errors
def get_sensor_history():
    try:
        query = """
            SELECT temperature, humidity, soil_moisture, light_value as light, timestamp FROM sensor_data 
            WHERE temperature IS NOT NULL AND humidity IS NOT NULL AND soil_moisture IS NOT NULL AND light_value IS NOT NULL
            ORDER BY timestamp DESC LIMIT 100
        """
        sensor_data = DatabaseManager.execute_query(query)
        
        if not sensor_data:
            return jsonify([])
            
        return jsonify([{
            'temperature': float(row['temperature']),
            'humidity': float(row['humidity']),
            'soil_moisture': float(row['soil_moisture']),
            'light': float(row['light']),
            'timestamp': row['timestamp'].isoformat() if row['timestamp'] else None
        } for row in sensor_data])
        
    except Exception as e:
        logger.error(f"Error in get_sensor_history: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        DatabaseManager.initialize_database()
        socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True, log_output=True, use_reloader=False)