
#include <SPI.h>
#include <Wire.h>
#include <TFT_eSPI.h>
#include "DHTesp.h"
#include "RTClib.h"
#include <WiFi.h>
#include <HTTPClient.h>

// -------- WIFI --------
const char* ssid = "Redmi Note 10";
const char* password = "said2021.";

// -------- THINGSPEAK --------
String apiKey1 = "NB7B4NWLMJW082QO"; // DHT1 → DHT4
String apiKey2 = "DYDKCYGX7MX841YL"; // DHT5 → DHT8

// -------- TFT --------
TFT_eSPI tft = TFT_eSPI();

// -------- RTC --------
RTC_DS3231 rtc;

// -------- DHT --------
#define DHT_COUNT 8
int DHT_PINS[DHT_COUNT] = {27,14,12,13,25,26,33,32};
DHTesp dht[DHT_COUNT];

// -------- MEMOIRE STABLE --------
float lastT[8] = {0};
float lastH[8] = {0};

// -------- SETUP --------
void setup() {
  Serial.begin(115200);

  for(int i=0;i<8;i++){
    dht[i].setup(DHT_PINS[i], DHTesp::DHT22);
  }

  Wire.begin(21,22);
  rtc.begin();

  tft.init();
  tft.setRotation(1);
  tft.fillScreen(TFT_BLACK);

  WiFi.begin(ssid, password);
}

// -------- HEURE --------
void afficherHeure() {
  DateTime now = rtc.now();

  char d[20], t[20];
  sprintf(d,"%02d/%02d/%04d",now.day(),now.month(),now.year());
  sprintf(t,"%02d:%02d:%02d",now.hour(),now.minute(),now.second());

  tft.setTextColor(TFT_YELLOW);
  tft.setTextSize(3);
  tft.setCursor(100,110);
  tft.println(d);

  tft.setTextSize(4);
  tft.setCursor(90,140);
  tft.println(t);
}

// -------- PAGE 1 --------
void afficherPage1(bool wifiOK){
  tft.fillScreen(TFT_BLACK);

  tft.setTextColor(TFT_GREEN);
  tft.setTextSize(3);
  tft.setCursor(30,20);
  tft.println("Universite Bechar");

  tft.setTextColor(TFT_WHITE);
  tft.setCursor(80,60);
  tft.println("SECHOIR SOLAIRE");

  afficherHeure();

  tft.setCursor(80,200);
  tft.setTextColor(wifiOK?TFT_GREEN:TFT_RED);
  tft.println(wifiOK?"ENVOI OK":"HORS LIGNE");
}

// -------- PAGE 2 --------
void afficherPage2(float t[], float h[]){
  tft.fillScreen(TFT_BLACK);

  for(int i=0;i<4;i++){
    int y=40+i*60;

    tft.setTextSize(3);
    tft.setTextColor(TFT_WHITE);
    tft.setCursor(20,y);
    tft.printf("DHT%d",i+1);

    tft.setTextColor(TFT_RED);
    tft.setCursor(150,y);
    tft.printf("%.1fC",t[i]);

    tft.setTextColor(TFT_CYAN);
    tft.setCursor(300,y);
    tft.printf("%.1f%%",h[i]);

    tft.drawLine(10,y+45,470,y+45,TFT_DARKGREY);
  }
}

// -------- PAGE 3 --------
void afficherPage3(float t[], float h[]){
  tft.fillScreen(TFT_BLACK);

  for(int i=4;i<8;i++){
    int y=40+(i-4)*60;

    tft.setTextSize(3);
    tft.setTextColor(TFT_WHITE);
    tft.setCursor(20,y);
    tft.printf("DHT%d",i+1);

    tft.setTextColor(TFT_RED);
    tft.setCursor(150,y);
    tft.printf("%.1fC",t[i]);

    tft.setTextColor(TFT_CYAN);
    tft.setCursor(300,y);
    tft.printf("%.1f%%",h[i]);

    tft.drawLine(10,y+45,470,y+45,TFT_DARKGREY);
  }
}

// -------- ENVOI 2 CHANNELS --------
void sendToThingSpeak(float t[], float h[]){

  if(WiFi.status()!=WL_CONNECTED) return;

  HTTPClient http;

  // CHANNEL 1
  String url1="http://api.thingspeak.com/update?api_key="+apiKey1;
  url1+="&field1="+String(t[0]);
  url1+="&field2="+String(h[0]);
  url1+="&field3="+String(t[1]);
  url1+="&field4="+String(h[1]);
  url1+="&field5="+String(t[2]);
  url1+="&field6="+String(h[2]);
  url1+="&field7="+String(t[3]);
  url1+="&field8="+String(h[3]);

  http.begin(url1);
  http.GET();
  http.end();

  delay(16000); // 🔥 obligatoire

  // CHANNEL 2
  String url2="http://api.thingspeak.com/update?api_key="+apiKey2;
  url2+="&field1="+String(t[4]);
  url2+="&field2="+String(h[4]);
  url2+="&field3="+String(t[5]);
  url2+="&field4="+String(h[5]);
  url2+="&field5="+String(t[6]);
  url2+="&field6="+String(h[6]);
  url2+="&field7="+String(t[7]);
  url2+="&field8="+String(h[7]);

  http.begin(url2);
  http.GET();
  http.end();
}

// -------- LOOP --------
void loop(){

  float t[8],h[8];

  for(int i=0;i<8;i++){
    TempAndHumidity d=dht[i].getTempAndHumidity();

    if(!isnan(d.temperature)&&!isnan(d.humidity)){
      t[i]=d.temperature;
      h[i]=d.humidity;
      lastT[i]=t[i];
      lastH[i]=h[i];
    }else{
      t[i]=lastT[i];
      h[i]=lastH[i];
    }
  }

  bool wifiOK=(WiFi.status()==WL_CONNECTED);

  afficherPage1(wifiOK);

  if(wifiOK){
    sendToThingSpeak(t,h);
  }

  delay(5000);
  afficherPage2(t,h);

  delay(5000);
  afficherPage3(t,h);

  delay(5000);
}