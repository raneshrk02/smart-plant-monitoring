import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class ThresholdConfig:
    SOIL_MOISTURE: int = 30  
    LIGHT: int = 1560  
    TEMPERATURE: float = 35.0  
    HUMIDITY: float = 40.0  

class Config:
    DB_CONFIG = {
        "host": "127.0.0.1",
        "user": os.getenv('DB_USER'),
        "password": os.getenv('DB_PASSWORD'),
        "database": "plant_monitoring",
        "charset": 'utf8mb4',
        "connect_timeout": 10,
        "port": 3306,  
        "ssl": None,  
    }
    THRESHOLDS = ThresholdConfig()
    VALID_ACTUATORS = ['water_pump', 'humidifier', 'cooling_fan']