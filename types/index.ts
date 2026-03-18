export interface FuelType {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  unit: string;
  pricePerUnit?: number;
}

export interface StationFuel {
  fuel: FuelType;
  pricePerUnit: number;
}

export interface Station {
  _id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  fuels: StationFuel[];
  rating: number;
  totalRatings?: number;
  image?: string;
  state?: string;
  lga?: string;
  verified?: boolean;
  /** computed on client — distance in km from the user */
  distance?: number;
  /** computed on client — price for the selected fuel type */
  price?: number;
}
