"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

import { APIProvider, Map, AdvancedMarker, useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import type { MapCameraChangedEvent } from '@vis.gl/react-google-maps';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider"; // Importando o Slider
import { Label } from "@/components/ui/label"; // Importando o Label
import { useToast } from '@/hooks/use-toast';

// Ícones
import { Map as MapIcon, Save, Trash2, Loader2, MapPin, Layers, BarChart } from 'lucide-react';

// Tipos personalizados do seu projeto
import type { Location } from '@/types';


type PlaceResult = google.maps.places.PlaceResult;
type LatLngLiteral = google.maps.LatLngLiteral;
type LayerType = 'temperature' | 'air_quality' | 'precipitation' | 'land_use' | 'human_activity';


export default function GeoSearchPage() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Erro de Configuração</CardTitle>
            <CardDescription>
              A chave da API do Google Maps está em falta. Adicione-a às suas variáveis de ambiente como NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['places']}>
      <GeoSearchContent />
    </APIProvider>
  );
}

function GeoSearchContent() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [position, setPosition] = useState<LatLngLiteral>({ lat: 40.749933, lng: -73.98633 });
  const [zoom, setZoom] = useState(10);
  const [eeTileUrl, setEeTileUrl] = useState<string | null>(null);
  const [isEeLoading, setIsEeLoading] = useState(false);
  const [layerOpacity, setLayerOpacity] = useState(0.6); // Estado para a opacidade da camada

  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePlaceSelect = useCallback((place: PlaceResult) => {
    setSelectedPlace(place);
    setSelectedLocation(null);
    if (place.geometry?.location) {
      const newPos = place.geometry.location.toJSON();
      setPosition(newPos);
      setZoom(12);
    }
  }, []);

  const handleLocationSelect = useCallback((location: Location) => {
    setSelectedLocation(location);
    setSelectedPlace(null);
    const newPos = { lat: location.lat, lng: location.lng };
    setPosition(newPos);
    setZoom(14);
    if(inputRef.current) inputRef.current.value = location.name;
  }, []);
  
  const handleCameraChange = useCallback((ev: MapCameraChangedEvent) => {
    setPosition(ev.detail.center);
    setZoom(ev.detail.zoom);
  }, []);

  const handleSave = () => {
    if (!selectedPlace || !selectedPlace.geometry?.location) return;

    const locationData: Location = {
      id: Date.now().toString(),
      name: selectedPlace.name || 'Local sem nome',
      address: selectedPlace.formatted_address || '',
      lat: selectedPlace.geometry.location.lat(),
      lng: selectedPlace.geometry.location.lng(),
    };

    toast({ title: "Localização Salva!", description: `${locationData.name} foi salva.` });
    setLocations(prev => [locationData, ...prev]);
    setSelectedPlace(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = (id: string, name: string) => {
    toast({ title: "Localização Apagada", description: `${name} foi removida.` });
    setLocations(prev => prev.filter(loc => loc.id !== id));
    if (selectedLocation?.id === id) {
      setSelectedLocation(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleAnalysis = useCallback(() => {
    const location = selectedPlace || selectedLocation;
    if (!location) return;

    const locationName = selectedPlace ? selectedPlace.name : selectedLocation?.name;

    toast({
      title: "Análise de Melhorias",
      description: `A funcionalidade de análise para ${locationName} ainda não foi implementada.`,
    });
  }, [selectedPlace, selectedLocation, toast]);
  
  const handleLayerChange = async (layer: LayerType | 'none') => {
    if (layer === 'none') {
      setEeTileUrl(null);
      return;
    }

    setIsEeLoading(true);
    try {
      const response = await fetch(`/api/earthengine?layer=${layer}`);
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.details || response.statusText;
        throw new Error(errorMessage);
      }

      setEeTileUrl(data.urlFormat);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido";
      toast({ variant: 'destructive', title: "Erro ao carregar a camada", description: errorMessage });
      setEeTileUrl(null);
    } finally {
      setIsEeLoading(false);
    }
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
                <CardDescription>Pesquise, encontre e analise localizações.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 overflow-y-hidden">
            <div className="space-y-2">
              <PlaceAutocomplete onPlaceSelect={handlePlaceSelect} inputRef={inputRef} />
              <Button onClick={handleSave} disabled={!selectedPlace} className="w-full">
                <Save className="mr-2 h-4 w-4" /> Salvar Localização Atual
              </Button>
              <Button onClick={handleAnalysis} disabled={!selectedPlace && !selectedLocation} className="w-full">
                <BarChart className="mr-2 h-4 w-4" /> Análise de Melhorias
              </Button>
            </div>

            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary"/>
                  <h3 className="font-semibold">Camadas de Dados</h3>
                </div>
              </div>
              <Select onValueChange={(value) => handleLayerChange(value as LayerType | 'none')} disabled={isEeLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma camada de dados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  <SelectItem value="temperature">Temperatura da Superfície</SelectItem>
                  <SelectItem value="air_quality">Qualidade do Ar (NO2)</SelectItem>
                  <SelectItem value="precipitation">Precipitação</SelectItem>
                  <SelectItem value="land_use">Uso do Solo</SelectItem>
                  <SelectItem value="human_activity">Atividade Humana</SelectItem>
                </SelectContent>
              </Select>
              {isEeLoading && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando camada...</div>}

              {eeTileUrl && (
                <div className="space-y-3 pt-2">
                  <Label htmlFor="opacity-slider">Opacidade da Camada</Label>
                  <Slider
                    id="opacity-slider"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[layerOpacity]}
                    onValueChange={(value) => setLayerOpacity(value[0])}
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="flex flex-1 flex-col gap-2 overflow-y-hidden">
              <h3 className="font-semibold">Localizações Salvas</h3>
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {locations.length > 0 ? locations.map((loc) => (
                    <Card key={loc.id} className={`p-3 transition-colors hover:bg-secondary/50 ${selectedLocation?.id === loc.id ? 'bg-secondary' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => handleLocationSelect(loc)}>
                          <p className="font-semibold">{loc.name}</p>
                          <p className="text-sm text-muted-foreground">{loc.address}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(loc.id, loc.name)} aria-label={`Apagar ${loc.name}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  )) : (
                    <div className="text-center text-muted-foreground py-8">Nenhuma localização salva.</div>
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
          zoom={zoom}
          onCameraChanged={handleCameraChange}
          mapId="DEMO_MAP_ID"
          className="h-full w-full"
          gestureHandling={'greedy'}
          zoomControl={true}
          fullscreenControl={true}
          streetViewControl={false}
          mapTypeControl={false}
        >
          {markerPosition && <AdvancedMarker position={markerPosition}>
            <MapPin className="h-8 w-8 text-primary" />
          </AdvancedMarker>}
          {eeTileUrl && <EarthEngineLayer tileUrl={eeTileUrl} opacity={layerOpacity} />} {/* Passando a opacidade como prop */}
        </Map>
      </main>
    </div>
  );
}

function PlaceAutocomplete({ onPlaceSelect, inputRef }: { onPlaceSelect: (place: PlaceResult) => void; inputRef: React.RefObject<HTMLInputElement> }) {
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const ac = new places.Autocomplete(inputRef.current, {
      fields: ["place_id", "geometry", "name", "formatted_address"],
    });
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place.geometry) {
        onPlaceSelect(place);
      }
    });

    return () => {
        listener.remove();
    }
  }, [places, inputRef, onPlaceSelect]);

  return (
    <div className="relative">
      <Input ref={inputRef} placeholder="Pesquisar um endereço" />
    </div>
  );
}

// Componente para renderizar a camada do Earth Engine
function EarthEngineLayer({ tileUrl, opacity }: { tileUrl: string, opacity: number }) { // Recebendo a opacidade como prop
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const eeMapType = new google.maps.ImageMapType({
      getTileUrl: (coord, zoom) => {
        return tileUrl.replace('{x}', String(coord.x)).replace('{y}', String(coord.y)).replace('{z}', String(zoom));
      },
      tileSize: new google.maps.Size(256, 256),
      name: 'EarthEngineLayer',
      maxZoom: 18,
      opacity: opacity // Usando a opacidade recebida
    });

    // Adiciona a nova camada. Como as props mudam, a camada antiga é removida e uma nova é adicionada.
    map.overlayMapTypes.push(eeMapType);

    // Função de limpeza para remover a camada quando o componente é desmontado ou as props mudam
    return () => {
      const overlayArray = map.overlayMapTypes.getArray();
      const index = overlayArray.indexOf(eeMapType);
      if (index > -1) {
        map.overlayMapTypes.removeAt(index);
      }
    };
  }, [map, tileUrl, opacity]); // Re-executa o efeito quando a opacidade muda

  return null;
}
