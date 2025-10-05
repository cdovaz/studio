export type Location = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type LocationData = Omit<Location, 'id'>;
