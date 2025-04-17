from typing import Dict, Any
from datetime import datetime
from .config import Config
from .database import DatabaseManager

class SensorData:
    @staticmethod
    def check_thresholds(data: Dict[str, Any]) -> Dict[str, bool]:
        thresholds = {
            'water_pump': data['soil_moisture'] < Config.THRESHOLDS.SOIL_MOISTURE,
            'cooling_fan': data['temperature'] > Config.THRESHOLDS.TEMPERATURE,
            'humidifier': data['humidity'] < Config.THRESHOLDS.HUMIDITY
        }
        return thresholds

    @staticmethod
    def log_data(data: Dict[str, Any], socketio) -> None:
        actuator_states = SensorData.check_thresholds(data)
        
        data['water_pump'] = data.get('water_pump', False) or actuator_states['water_pump']
        data['humidifier'] = data.get('humidifier', False) or actuator_states['humidifier']
        data['cooling_fan'] = data.get('cooling_fan', False) or actuator_states['cooling_fan']

        query = """
            INSERT INTO sensor_data (temperature, humidity, soil_moisture, light_value, water_pump, humidifier, cooling_fan)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
        """
        DatabaseManager.execute_query(
            query, 
            (data['temperature'], data['humidity'], 
             data['soil_moisture'], data['light'],
             data['water_pump'],
             data['humidifier'],
             data['cooling_fan'])
        )

        emit_data = {
            'timestamp': data.get('timestamp', datetime.now()),
            'temperature': data['temperature'],
            'humidity': data['humidity'],
            'soil_moisture': data['soil_moisture'],
            'light_value': data['light'],
            'water_pump': data['water_pump'],
            'humidifier': data['humidifier'],
            'cooling_fan': data['cooling_fan']
        }
        
        if isinstance(emit_data['timestamp'], datetime):
            emit_data['timestamp'] = emit_data['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
            
        socketio.emit('sensor_update', emit_data)

    @staticmethod
    def log_status(data: Dict[str, Any], socketio) -> None:
        query = """
            UPDATE actuator_state SET water_pump = %s, humidifier = %s, cooling_fan = %s WHERE id = 1;
        """
        DatabaseManager.execute_query(
            query, 
            (data.get('water_pump', False),
             data.get('humidifier', False),
             data.get('cooling_fan', False))
        )
        actuator_states = {
            'water_pump': data.get('water_pump', False),
            'humidifier': data.get('humidifier', False),
            'cooling_fan': data.get('cooling_fan', False)
        }
        
        socketio.emit('actuator_update', actuator_states)