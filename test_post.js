const payload = {
  deviceId: "sechoir-solaire-esp32",
  readings: [
    {sensor: "DHT1", temperature: 25.5, humidity: 45.0}
  ]
};

fetch("https://solordraying.vercel.app/api/readings", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "Sechoir_Bechar_2026"
  },
  body: JSON.stringify(payload)
})
.then(res => res.json().then(data => ({status: res.status, data})))
.then(console.log)
.catch(console.error);
