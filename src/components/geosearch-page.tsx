"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, Control, ControlPosition } from '@vis.gl/react-google-maps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { saveLocation, deleteLocation } from '@/app/actions';
import type { Location } from '@/types';
import { Map as MapIcon, Save, Trash2, Loader2, MapPin } from 'lucide-react';

type PlaceResult = google.maps.places.PlaceResult;
type LatLngLiteral = google.maps.LatLngLiteral;

export default function GeoSearchPage({ initialLocations }: { initialLocations: Location[] }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Configuration Error</CardTitle>
            <CardDescription>
              Google Maps API key is missing. Please add it to your environment variables as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['places']}>
      <GeoSearchContent initialLocations={initialLocations} />
    </APIProvider>
  );
}

function GeoSearchContent({ initialLocations }: { initialLocations: Location[] }) {
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [position, setPosition] = useState<LatLngLiteral>({ lat: 40.749933, lng: -73.98633 });
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePlaceSelect = useCallback((place: PlaceResult) => {
    setSelectedPlace(place);
    setSelectedLocation(null);
    if (place.geometry?.location) {
      setPosition(place.geometry.location.toJSON());
    }
  }, []);

  const handleLocationSelect = useCallback((location: Location) => {
    setSelectedLocation(location);
    setSelectedPlace(null);
    setPosition({ lat: location.lat, lng: location.lng });
    if(inputRef.current) inputRef.current.value = location.name;
  }, []);

  const handleSave = () => {
    if (!selectedPlace || !selectedPlace.geometry?.location) return;

    const locationData = {
      name: selectedPlace.name || 'Unnamed Location',
      address: selectedPlace.formatted_address || '',
      lat: selectedPlace.geometry.location.lat(),
      lng: selectedPlace.geometry.location.lng(),
    };

    startTransition(async () => {
      const result = await saveLocation(locationData);
      if (result.success && result.id) {
        toast({ title: "Location Saved!", description: `${locationData.name} has been saved.` });
        setLocations(prev => [{ id: result.id!, ...locationData }, ...prev]);
        setSelectedPlace(null);
        if (inputRef.current) inputRef.current.value = '';
      } else {
        toast({ variant: 'destructive', title: "Error", description: result.error });
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    startTransition(async () => {
      const result = await deleteLocation(id);
      if (result.success) {
        toast({ title: "Location Deleted", description: `${name} has been removed.` });
        setLocations(prev => prev.filter(loc => loc.id !== id));
        if (selectedLocation?.id === id) {
          setSelectedLocation(null);
        }
      } else {
        toast({ variant: 'destructive', title: "Error", description: result.error });
      }
    });
  };

  const markerPosition = selectedPlace?.geometry?.location || (selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : null);

  return (
    <div className="flex h-screen w-full flex-col md:flex-row">
      <aside className="w-full flex-shrink-0 md:w-96">
        <Card className="flex h-full flex-col rounded-none border-0 border-r md:rounded-none">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center gap-3">
              <MapIcon className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl font-bold">GeoSearch App</CardTitle>
                <CardDescription>Search, find, and save locations.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 overflow-y-hidden">
            <div className="space-y-2">
              <PlaceAutocomplete onPlaceSelect={handlePlaceSelect} inputRef={inputRef} />
              <Button onClick={handleSave} disabled={!selectedPlace || isPending} className="w-full">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Save Current Location
              </Button>
            </div>
            <Separator />
            <div className="flex flex-1 flex-col gap-2 overflow-y-hidden">
              <h3 className="font-semibold">Saved Locations</h3>
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {locations.length > 0 ? locations.map((loc) => (
                    <Card key={loc.id} className={`p-3 transition-colors hover:bg-secondary/50 ${selectedLocation?.id === loc.id ? 'bg-secondary' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => handleLocationSelect(loc)}>
                          <p className="font-semibold">{loc.name}</p>
                          <p className="text-sm text-muted-foreground">{loc.address}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(loc.id, loc.name)}
                          disabled={isPending}
                          aria-label={`Delete ${loc.name}`}
                        >
                          {isPending && selectedLocation?.id === loc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                        </Button>
                      </div>
                    </Card>
                  )) : (
                    <div className="text-center text-muted-foreground py-8">No locations saved yet.</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </aside>
      <main className="flex-1">
        <Map
          center={position}
          zoom={13}
          mapId="DEMO_MAP_ID"
          className="h-full w-full"
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
          {markerPosition && <AdvancedMarker position={markerPosition}>
            <MapPin className="h-8 w-8 text-primary" />
          </AdvancedMarker>}
        </Map>
      </main>
    </div>
  );
}

function PlaceAutocomplete({ onPlaceSelect, inputRef }: { onPlaceSelect: (place: PlaceResult) => void; inputRef: React.RefObject<HTMLInputElement> }) {
  const [autoComplete, setAutoComplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["place_id", "geometry", "name", "formatted_address"],
    });
    setAutoComplete(ac);
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place.geometry) {
        onPlaceSelect(place);
      }
    });
  }, [inputRef, onPlaceSelect]);

  return (
    <div className="relative">
      <Input ref={inputRef} placeholder="Search for an address" />
    </div>
  );
}
