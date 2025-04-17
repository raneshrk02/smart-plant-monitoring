import logging
import os
import numpy as np
from joblib import load

logger = logging.getLogger(__name__)

def load_model():
    try:
        model_path = 'xgboost_plant_health.pkl'
        if not os.path.exists(model_path):
            logger.error(f"Model file not found at: {model_path}")
            return None
        else:
            model = load(model_path)
            logger.info("ML model loaded successfully")
            return model
    except Exception as e:
        logger.error(f"Error loading ML model: {str(e)}")
        return None

def predict_plant_health(model, features):
    if model is None:
        raise ValueError("ML model not loaded")
    
    numeric_prediction = model.predict(features)[0]
    status_mapping = {0: "Healthy", 1: "Moderate Stress", 2: "High Stress"}
    prediction_status = status_mapping.get(numeric_prediction, "Unknown")
    
    return prediction_status