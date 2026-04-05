import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import { Location, Geofence } from '../types';

// Fix Leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  center: Location;
  zoom?: number;
  markers?: Array<{
    position: Location;
    label: string;
    type?: 'user' | 'spot' | 'danger' | 'help';
  }>;
  geofences?: Geofence[];
  onLocationSelect?: (location: Location) => void;
}

function RecenterMap({ center }: { center: Location }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude]);
  }, [center, map]);
  return null;
}

export default function Map({ center, zoom = 13, markers = [], geofences = [], onLocationSelect }: MapProps) {
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={zoom}
      className="w-full h-full rounded-xl shadow-lg border border-slate-200"
      style={{ minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap center={center} />
      
      {markers.map((marker, idx) => (
        <Marker key={idx} position={[marker.position.latitude, marker.position.longitude]}>
          <Popup>
            <div className="p-1">
              <p className="font-bold text-slate-900">{marker.label}</p>
              <p className="text-xs text-slate-500">{marker.type?.toUpperCase()}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {geofences.map((gf, idx) => {
        let color = 'blue';
        if (gf.type === 'HIGH_RISK' || gf.type.startsWith('DANGER_')) color = '#ff4d4d'; // Light Red
        else if (gf.type === 'HELP_CENTER' || gf.type === 'TOURIST_OFFICE') color = '#4d79ff'; // Blue
        else if (gf.type === 'VIEW_SPOT') color = '#4dff4d'; // Light Green
        else if (gf.type === 'TOURIST_SPOT') color = '#ffcc00'; // Yellow/Gold

        return (
          <Circle
            key={idx}
            center={[gf.center.latitude, gf.center.longitude]}
            radius={gf.radius}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 0.2,
            }}
          >
            <Popup>
              <div className="p-1">
                <p className="font-bold text-slate-900">{gf.name}</p>
                <p className="text-xs text-slate-500">{gf.type.replace('_', ' ')}</p>
                {gf.riskScore && <p className="text-xs text-red-500">Risk Score: {gf.riskScore}</p>}
              </div>
            </Popup>
          </Circle>
        );
      })}
    </MapContainer>
  );
}
