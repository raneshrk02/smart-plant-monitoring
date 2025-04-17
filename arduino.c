#define BLYNK_TEMPLATE_ID "TEMPLATE_ID"
#define BLYNK_TEMPLATE_NAME "TEMPLATE_NAME"
#define BLYNK_AUTH_TOKEN "AUTH_TOKEN"
#define BLYNK_PRINT Serial

#include <WiFi.h>
#include <BlynkSimpleEsp32.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiClientSecure.h>
#include <WebSocketsClient.h>

char ssid[] = "SSID";
char pass[] = "PASSWORD";
char auth[] = "AUTH_TOKEN";

const char *websocketHost = "url.ngrok-free.app";
const char *logDataUrl = "https://url.ngrok-free.app/api/sensor_data";
const char *actuatorUrl = "https://url.ngrok-free.app/api/actuator";

#define DHTPIN 32
#define DHTTYPE DHT11
#define SOIL_SENSOR_PIN 36  
#define LDR_PIN 34
#define LED_ALERT_PIN 2    
#define WATER_PUMP_RELAY_PIN 15  
#define TEMP_RELAY_PIN 18   
#define HUMID_RELAY_PIN 19  

#define SOIL_MOISTURE_THRESHOLD 30
#define LIGHT_INTENSITY_THRESHOLD 1560
#define TEMPERATURE_THRESHOLD 35
#define HUMIDITY_THRESHOLD 40

float temperature = 0.0;
float humidity = 0.0;
int soilMoisture = 0;
int lightValue = 0;

bool water_pump = false;
bool humidifier = false;
bool cooling_fan = false;

bool water_pump_server = false;
bool humidifier_server = false;
bool cooling_fan_server = false;

BlynkTimer timer;

DHT dht(DHTPIN, DHTTYPE);
WebSocketsClient webSocket;

BLYNK_WRITE(V5) { 
  water_pump_server = param.asInt();
  Serial.printf("Water pump manually %s via Blynk\n", water_pump_server ? "activated" : "deactivated");
}

BLYNK_WRITE(V6) { 
  cooling_fan_server = param.asInt();
  Serial.printf("Cooling fan manually %s via Blynk\n", cooling_fan_server ? "activated" : "deactivated");
}

BLYNK_WRITE(V7) { 
  humidifier_server = param.asInt();
  Serial.printf("Humidifier manually %s via Blynk\n", humidifier_server ? "activated" : "deactivated");
}

void handleServerOverrides() {
  if (water_pump_server) {
    digitalWrite(WATER_PUMP_RELAY_PIN, HIGH);
    Serial.println("Manual water pump ON");
  } else if (!water_pump) {  
    digitalWrite(WATER_PUMP_RELAY_PIN, LOW);
    Serial.println("Water pump OFF");
  }
  
  if (humidifier_server) {
    digitalWrite(HUMID_RELAY_PIN, HIGH);
    Serial.println("Manual humidifier ON");
  } else if (!humidifier) {  
    digitalWrite(HUMID_RELAY_PIN, LOW);
    Serial.println("Humidifier OFF");
  }
  
  if (cooling_fan_server) {
    digitalWrite(TEMP_RELAY_PIN, HIGH);
    Serial.println("Manual cooling fan ON");
  } else if (!cooling_fan) {  
    digitalWrite(TEMP_RELAY_PIN, LOW);
    Serial.println("Cooling fan OFF");
  }
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("WebSocket Disconnected! Attempting to reconnect...");
            break;
        case WStype_CONNECTED:
            Serial.println("WebSocket Connected!");
            webSocket.sendPing();
            break;
        case WStype_TEXT:
            Serial.printf("WebSocket received: %s\n", payload);
            break;
        case WStype_ERROR:
            Serial.println("WebSocket Error!");
            webSocket.disconnect();
            delay(1000);
            webSocket.beginSSL(websocketHost, 443, "/socket.io/?EIO=4&transport=websocket", "arduino");
            break;
    }
}

void sendSensorDataToBlynk() {
  Blynk.virtualWrite(V1, soilMoisture);      
  Blynk.virtualWrite(V2, lightValue);        
  Blynk.virtualWrite(V3, temperature);       
  Blynk.virtualWrite(V4, humidity);          
  
  Blynk.virtualWrite(V5, water_pump ? 1 : 0);   
  Blynk.virtualWrite(V6, cooling_fan ? 1 : 0);  
  Blynk.virtualWrite(V7, humidifier ? 1 : 0);    
}

void setup() {
  Serial.begin(115200);
  Serial.println("--- Starting setup ---\n");  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(1000);
  int maxAttempts = 5;
  int attempt = 0;
  
  while (attempt < maxAttempts && WiFi.status() != WL_CONNECTED) {
    Serial.printf("\nAttempt %d: Connecting to %s\n", attempt + 1, ssid);
    WiFi.begin(ssid, pass);    
    int timeout = 0;
    while (timeout < 10 && WiFi.status() != WL_CONNECTED) {
      delay(1000);
      timeout++;
      Serial.print(".");
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nConnected to WiFi successfully!");
      Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
      break;
    } else {
      Serial.println("\nConnection failed!");
      WiFi.disconnect(true);
      delay(1000);
    }
    attempt++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Blynk.begin(auth, ssid, pass);
    Serial.println("Blynk connected!");
    
    timer.setInterval(5000L, sendSensorDataToBlynk);
  }

  Serial.println("\nInitializing sensors...");
  dht.begin();
  Serial.println("\nSetting up pin modes...");
  pinMode(SOIL_SENSOR_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);
  pinMode(LED_ALERT_PIN, OUTPUT);
  pinMode(WATER_PUMP_RELAY_PIN, OUTPUT);
  pinMode(TEMP_RELAY_PIN, OUTPUT);
  pinMode(HUMID_RELAY_PIN, OUTPUT);

  digitalWrite(WATER_PUMP_RELAY_PIN, LOW);
  digitalWrite(TEMP_RELAY_PIN, LOW);
  digitalWrite(HUMID_RELAY_PIN, LOW);
  if (WiFi.status() == WL_CONNECTED) {
    webSocket.setReconnectInterval(5000);
    webSocket.enableHeartbeat(15000, 3000, 2);
    webSocket.beginSSL(
        websocketHost,
        443,
        "/socket.io/?EIO=4&transport=websocket",
        "arduino"
    );
    webSocket.onEvent(webSocketEvent);
  }

  Serial.println("\n--- Setup complete! ---\n");
}

void readAndPrintSensorValues() {
  soilMoisture = map(analogRead(SOIL_SENSOR_PIN), 0, 4095, 0, 100);
  lightValue = analogRead(LDR_PIN);
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  Serial.println("\n--- Sensor Readings ---");
  Serial.print("Soil Moisture: ");
  Serial.println(soilMoisture);
  Serial.print("Light Intensity: ");
  Serial.println(lightValue);
  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println("°C");
  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.println("%");
  Serial.println("--------------------\n");
}

void sendSensorData() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    Serial.println("\n--- Logging Data to Server ---\n");
    HTTPClient https;
    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(20000);
    if (https.begin(client, logDataUrl)) {
        https.addHeader("Content-Type", "application/json");
        https.setTimeout(20000);
        
        StaticJsonDocument<256> json;
        json["timestamp"] = millis();
        json["temperature"] = temperature;
        json["humidity"] = humidity;
        json["soil_moisture"] = soilMoisture;
        json["light"] = lightValue;
        json["water_pump"] = water_pump;
        json["humidifier"] = humidifier;
        json["cooling_fan"] = cooling_fan;

        String payload;
        serializeJson(json, payload);
        Serial.print("Sending: ");
        Serial.println(payload);
        int retries = 3;
        int httpResponseCode;
        
        while (retries > 0) {
            httpResponseCode = https.POST(payload);
            if (httpResponseCode > 0) break;
            Serial.printf("Retry attempt %d...\n", 4 - retries);
            delay(1000);
            retries--;
        }
        
        if (httpResponseCode > 0) {
            Serial.print("HTTP Response code: ");
            Serial.println(httpResponseCode);
            String response = https.getString();
            
            StaticJsonDocument<256> responseJson;
            DeserializationError error = deserializeJson(responseJson, response);
            
            if (!error) {
                JsonObject actuator_states = responseJson["actuator_states"];
                if (actuator_states) {
                    water_pump = actuator_states["water_pump"];
                    humidifier = actuator_states["humidifier"];
                    cooling_fan = actuator_states["cooling_fan"];
                }
            }
        } else {
            Serial.print("Error code: ");
            Serial.println(httpResponseCode);
        }
        https.end();
    }
}

void fetchActuatorStates() {
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.println("\n--- Checking Actuator States ---");
  HTTPClient http;
  WiFiClientSecure client;
  client.setInsecure();
  
  if (http.begin(client, actuatorUrl)) {
    int httpResponseCode = http.GET();
    if (httpResponseCode > 0) {
      Serial.print("HTTP Response code: ");
      Serial.println(httpResponseCode);
      String response = http.getString();

      StaticJsonDocument<256> json;
      DeserializationError error = deserializeJson(json, response);

      if (!error) {
        water_pump_server = json["water_pump"];
        humidifier_server = json["humidifier"];
        cooling_fan_server = json["cooling_fan"];
        Serial.println("Actuator states updated successfully");
      }
    }
    http.end();
  }
}

void setDeviceState() {
  water_pump = soilMoisture < SOIL_MOISTURE_THRESHOLD;
  cooling_fan = temperature > TEMPERATURE_THRESHOLD;
  humidifier = humidity < HUMIDITY_THRESHOLD;
}

void performActions() {
  if (soilMoisture < SOIL_MOISTURE_THRESHOLD && !water_pump_server) {
    Serial.println("Soil moisture low. Activating water pump.");
    digitalWrite(WATER_PUMP_RELAY_PIN, HIGH);
    delay(3000); 
    digitalWrite(WATER_PUMP_RELAY_PIN, LOW);
    water_pump = false; 
    Serial.println("Watering completed.");
  }
  
  if (lightValue > LIGHT_INTENSITY_THRESHOLD) { 
    Serial.println("Light intensity low. Notify user.");
    digitalWrite(LED_ALERT_PIN, HIGH);
    delay(3000); 
    digitalWrite(LED_ALERT_PIN, LOW);
    Serial.println("Light notification alert sent.");
  }
  
  if (temperature > TEMPERATURE_THRESHOLD && !cooling_fan_server) {
    Serial.println("Temperature high. Activating cooling relay.");
    digitalWrite(TEMP_RELAY_PIN, HIGH);
    delay(5000);
    digitalWrite(TEMP_RELAY_PIN, LOW);
    cooling_fan = false;  
    Serial.println("Cooling operation completed.");
  }
  
  if (humidity < HUMIDITY_THRESHOLD && !humidifier_server) {
    Serial.println("Humidity low. Activating humidifier relay.");
    digitalWrite(HUMID_RELAY_PIN, HIGH);
    delay(5000);
    digitalWrite(HUMID_RELAY_PIN, LOW);
    humidifier = false; 
    Serial.println("Humidifier operation completed.");
  }
}

void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi disconnected. Attempting to reconnect...");
        WiFi.begin(ssid, pass);
        delay(5000);  
    }
    if (WiFi.status() == WL_CONNECTED) {
        Blynk.run();
        timer.run(); 
    }
    if (WiFi.status() == WL_CONNECTED) {
        webSocket.loop();
        if (!webSocket.isConnected()) {
            webSocket.beginSSL(websocketHost, 443, "/socket.io/?EIO=4&transport=websocket", "arduino");
        }
        sendSensorData();
        fetchActuatorStates();
        sendSensorDataToBlynk();
    }
    
    readAndPrintSensorValues();
    setDeviceState();
    handleServerOverrides();  
    performActions();  
    delay(5000);
}