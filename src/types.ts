import { Timestamp } from 'firebase/firestore';

export type UserRole = 'tourist' | 'police' | 'tourism_officer' | 'admin';

export interface Location {
  latitude: number;
  longitude: number;
  timestamp?: string;
}

export interface ItineraryPoint extends Location {
  label: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  lastKnownLocation?: Location;
  status?: 'active' | 'missing' | 'injured';
  isMissing?: boolean;
  qrCode?: string;
  
  // Advanced Features
  passportHash?: string;
  verificationHash?: string; // For temporary ID verification
  validUntil?: string;
  safetyScore: number; // 0-100
  itinerary?: ItineraryPoint[];
  failedLoginAttempts: number;
  trackingToken?: string;
  trackingEnabled: boolean;
  consentGiven: boolean;
  language: string;
  lastInteractionTime: number;
  interactionCount: number;
}

export interface Alert {
  id?: string;
  userId: string;
  userDisplayName?: string;
  type: 'SOS' | 'GEOFENCE_ENTER' | 'GEOFENCE_EXIT' | 'ROUTE_DEVIATION' | 'SILENT_DISTRESS' | 'WEATHER_ALERT' | 'MISSING_PERSON';
  location: Location;
  status: 'active' | 'resolved';
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Timestamp;
  details?: string;
}

export interface Geofence {
  id?: string;
  name: string;
  type: 'HIGH_RISK' | 'TOURIST_SPOT' | 'HELP_CENTER' | 'DANGER_THEFT' | 'DANGER_MURDER' | 'DANGER_MISSING' | 'DANGER_INJURY' | 'TOURIST_OFFICE' | 'VIEW_SPOT';
  center: Location;
  radius: number; // meters
  riskScore?: number;
}

export interface LedgerEntry {
  id?: string;
  userId: string;
  action: string;
  dataHash: string;
  previousHash: string;
  timestamp: Timestamp;
}

export interface WeatherData {
  temp: number;
  condition: string;
  riskLevel: 'low' | 'medium' | 'high';
  alerts: string[];
}

export interface CommunityReport {
  id?: string;
  userId: string;
  userDisplayName: string;
  type: 'SAFE' | 'CROWDED' | 'WELL_LIT' | 'UNSAFE' | 'HELPFUL_STAFF';
  location: Location;
  timestamp: Timestamp;
  comment?: string;
}

export interface SafetyConciergeMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
