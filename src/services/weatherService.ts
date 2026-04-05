import { WeatherData } from '../types';

export const weatherService = {
  async getWeatherData(lat: number, lon: number): Promise<WeatherData> {
    // In a real app, use a real API key. For this demo, I'll simulate a call.
    // const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=YOUR_KEY`);
    // const data = await response.json();
    
    // Simulating dynamic weather based on coordinates
    const isRainy = (lat + lon) % 2 === 0;
    const isStormy = (lat * lon) % 5 === 0;

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const alerts: string[] = [];

    if (isStormy) {
      riskLevel = 'high';
      alerts.push('Severe Storm Warning: Landslide risk in hilly areas.');
    } else if (isRainy) {
      riskLevel = 'medium';
      alerts.push('Heavy Rain: Expect slippery roads and low visibility.');
    }

    return {
      temp: 25 + (Math.random() * 10 - 5),
      condition: isStormy ? 'Stormy' : isRainy ? 'Rainy' : 'Clear',
      riskLevel,
      alerts,
    };
  }
};
