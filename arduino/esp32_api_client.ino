#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// API details
const char* serverUrl = "https://your-vercel-app.vercel.app/api/readings"; // OR http://your-local-ip:3000/api/readings for testing
const char* deviceApiKey = "YOUR_SECRET_DEVICE_KEY";
const char* deviceId = "sechoir-solaire-esp32";

// DHT Sensor definitions
#define DHTTYPE DHT22

// Update these pins to match your actual ESP32 wiring
const int dhtPins[8] = {13, 12, 14, 27, 26, 25, 33, 32};
DHT* dhts[8];

void setup() {
  Serial.begin(115200);

  // Initialize sensors
  for (int i = 0; i < 8; i++) {
    dhts[i] = new DHT(dhtPins[i], DHTTYPE);
    dhts[i]->begin();
  }

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-api-key", deviceApiKey); // Custom header for API Key

    // Construct JSON payload manually (for large payloads, ArduinoJson is recommended)
    // Example: {"deviceId":"sechoir-solaire-esp32","readings":[{"sensor":"DHT1","temperature":24.5,"humidity":60.2}, ...]}
    
    String payload = "{";
    payload += "\"deviceId\":\"" + String(deviceId) + "\",";
    payload += "\"readings\":[";

    for (int i = 0; i < 8; i++) {
      float t = dhts[i]->readTemperature();
      float h = dhts[i]->readHumidity();

      // Check if reading failed and handle it (use previous valid or 0)
      if (isnan(t)) t = 0.0;
      if (isnan(h)) h = 0.0;

      payload += "{";
      payload += "\"sensor\":\"DHT" + String(i + 1) + "\",";
      payload += "\"temperature\":" + String(t) + ",";
      payload += "\"humidity\":" + String(h);
      payload += "}";

      if (i < 7) {
        payload += ","; // Add comma between sensors
      }
    }
    
    payload += "]}";

    Serial.println("Sending Payload:");
    Serial.println(payload);

    // Send POST request
    int httpResponseCode = http.POST(payload);

    if (httpResponseCode > 0) {
      Serial.print("HTTP Response code: ");
      Serial.println(httpResponseCode);
      String response = http.getString();
      Serial.println(response);
    } else {
      Serial.print("Error code: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("WiFi Disconnected");
  }

  // Wait 10 seconds before sending next reading
  delay(10000);
}
