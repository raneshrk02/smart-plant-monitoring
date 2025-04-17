import logging
import pymysql #type: ignore
from typing import Optional, Any
from .config import Config

logger = logging.getLogger(__name__)

SCHEMA_UPDATES = """
CREATE DATABASE IF NOT EXISTS plant_monitoring;
USE plant_monitoring;

CREATE TABLE IF NOT EXISTS sensor_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    temperature FLOAT NOT NULL,
    humidity FLOAT NOT NULL,
    soil_moisture INT NOT NULL,
    light_value INT NOT NULL,
    water_pump BOOLEAN DEFAULT FALSE,
    humidifier BOOLEAN DEFAULT FALSE,
    cooling_fan BOOLEAN DEFAULT FALSE,
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS actuator_state (
    id INT PRIMARY KEY DEFAULT 1,
    water_pump BOOLEAN DEFAULT FALSE,
    humidifier BOOLEAN DEFAULT FALSE,
    cooling_fan BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO actuator_state (id, water_pump, humidifier, cooling_fan)
VALUES (1, FALSE, FALSE, FALSE) ON DUPLICATE KEY UPDATE id=id;

CREATE TABLE IF NOT EXISTS predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    prediction VARCHAR(20) NOT NULL,
    sensor_data_id INT,
    FOREIGN KEY (sensor_data_id) REFERENCES sensor_data(id),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

class DatabaseManager:
    @staticmethod
    def get_connection():
        try:
            return pymysql.connect(
                **Config.DB_CONFIG,
                cursorclass=pymysql.cursors.DictCursor
            )
        except Exception as e:
            logger.error(f"Database connection error: {str(e)}")
            raise

    @staticmethod
    def execute_query(query: str, params: Optional[tuple] = None) -> Any:
        try:
            with DatabaseManager.get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query, params or ())
                    if query.strip().upper().startswith('SELECT'):
                        result = cursor.fetchall()
                        return result
                    connection.commit()
                    return None
        except Exception as e:
            logger.error(f"Database error: {str(e)}")
            raise

    @staticmethod
    def initialize_database():
        try:
            conn = pymysql.connect(
                host=Config.DB_CONFIG["host"],
                user=Config.DB_CONFIG["user"],
                password=Config.DB_CONFIG["password"]
            )
            with conn.cursor() as cursor:
                for statement in SCHEMA_UPDATES.split(';'):
                    if statement.strip():
                        cursor.execute(statement)
                conn.commit()
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Database initialization error: {str(e)}")
            raise
        finally:
            if 'conn' in locals():
                conn.close()