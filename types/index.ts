export interface FuelType {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  unit: string;
}

export interface StationFuel {
  fuel: FuelType;
  pricePerUnit: number;
  /**
   * Convenience name for the fuel — server may flatten {fuel:{name}}
   * to a top-level string in some queries. Optional everywhere.
   */
  fuelName?: string;
}

export interface Station {
  _id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  fuels: StationFuel[];
  rating: number;
  totalRatings?: number;
  /** Single hero image. */
  image?: string;
  /** Photo strip — multiple uploaded photos. */
  images?: string[];
  state?: string;
  lga?: string;
  verified?: boolean;
  isOpen?: boolean;
  isPartner?: boolean;
  /** ISO date when vendor's partner subscription started. Surfaces as
   *  "Partner since {month year}" on the station detail sheet. */
  partnerSince?: string | null;
  /** Operating hours from server (Station.operatingHours subdoc). */
  operatingHours?: { open?: string; close?: string };
  /** Service-time copy (e.g. "~12 min from accept"). Drives an
   *  amenity chip on the detail sheet. */
  serviceTime?: string;
  /** Payment options accepted at the station (no cash on delivery). */
  paymentOptions?: string[];
  /** ISO timestamp of last successful Gaznger dispense at this station. */
  lastDispenseAt?: string;
  /** Rolling on-time rate, 0–100. Optional — first-timers have no data. */
  onTimeRate?: number;
  /** computed on client — distance in km from the user */
  distance?: number;
  /** Server-provided ETA in minutes (haversine × 3 heuristic). */
  etaMinutes?: number;
  /** computed on client — price for the selected fuel type */
  price?: number;
}
