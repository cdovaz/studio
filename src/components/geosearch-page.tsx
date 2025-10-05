'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

import { APIProvider, Map, AdvancedMarker, useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import type { MapCameraChangedEvent } from '@vis.gl/react-google-maps';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';

// Importações Atualizadas
import { triggerAnalysis } from '@/services/analysisService';
import { AnalysisPopup } from '@/components/analysis-popup'; // Importa o novo popup
import type { Location } from '@/types';

import { Map as MapIcon, Save, Trash2, Loader2, MapPin, Layers, BrainCircuit } from 'lucide-react';

type PlaceResult = google.maps.places.PlaceResult;
type LatLngLiteral = google.maps.LatLngLiteral;
type LayerType = 'temperature' | 'air_quality' | 'precipitation' | 'land_use' | 'human_activity';

// A lista de indicadores agora fica no frontend para ser enviada para a API
const INDICATORS_LIST = [
    { id: 'temperature', name: 'Temperatura' }, 
    { id: 'air_quality', name: 'Qualidade do Ar' }, 
    { id: 'land_use', name: 'Uso do Solo' }, 
    { id: 'human_activity', name: 'Atividade Humana' }
];

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
  const [position, setPosition] = useState<LatLngLiteral>({ lat: -23.5505, lng: -46.6333 }); // Padrão para São Paulo
  const [zoom, setZoom] = useState(10);
  const [eeTileUrl, setEeTileUrl] = useState<string | null>(null);
  const [isEeLoading, setIsEeLoading] = useState(false);
  const [layerOpacity, setLayerOpacity] = useState(0.6);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  // Novos estados para o popup
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [currentAnalysisLocation, setCurrentAnalysisLocation] = useState('');

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
    if (inputRef.current) inputRef.current.value = location.name;
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

  // Função de análise atualizada para chamar o Gemini e abrir o popup
  const handleAnalysis = useCallback(async () => {
    const address = inputRef.current?.value;

    if (!address) {
        toast({ variant: 'destructive', title: "Endereço Faltando", description: "Por favor, digite ou selecione um endereço antes de gerar a análise." });
        return;
    }

    setIsAnalysisLoading(true);
    setCurrentAnalysisLocation(address);
    toast({ title: "Gerando Análise...", description: "A IA está processando o plano de urbanismo. Isso pode levar um momento." });

    try {
        // A lista de indicadores agora é enviada no corpo da requisição
        const indicatorsForApi = INDICATORS_LIST.map(i => i.name);
        const result = await triggerAnalysis({ address, indicators: indicatorsForApi });

        if (result.success && result.analysis) {
            setAnalysisResult(result.analysis);
            setIsPopupOpen(true); // Abre o popup com o resultado
            toast({
              title: "Análise Concluída!",
              description: "O plano de urbanismo foi gerado com sucesso.",
            });
        } else {
          throw new Error(result.message || 'A API retornou uma resposta inesperada.');
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido";
        toast({
            variant: 'destructive',
            title: "Falha na Análise",
            description: `Erro: ${errorMessage}`,
        });
    } finally {
        setIsAnalysisLoading(false);
    }
  }, [toast]);
  
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
    <>
      <AnalysisPopup 
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        analysisText={analysisResult}
        location={currentAnalysisLocation}
      />
      <div className="flex h-screen w-full flex-col md:flex-row">
        <aside className="w-full flex-shrink-0 md:w-96">
          <Card className="flex h-full flex-col rounded-none border-0 border-r md:rounded-none">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center gap-3">
                <MapIcon className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="text-2xl font-bold">GeoSearch IA</CardTitle>
                  <CardDescription>Pesquise, analise e gere insights com IA.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4 overflow-y-hidden">
              <div className="space-y-2">
                <PlaceAutocomplete onPlaceSelect={handlePlaceSelect} inputRef={inputRef} />
                <Button onClick={handleSave} disabled={!selectedPlace} className="w-full">
                  <Save className="mr-2 h-4 w-4" /> Salvar Localização
                </Button>
                <Button onClick={handleAnalysis} disabled={isAnalysisLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  {isAnalysisLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BrainCircuit className="mr-2 h-4 w-4" />
                  )}
                  Gerar Análise Urbanística com IA
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
                    <SelectValue placeholder="Selecione uma camada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="temperature">Temperatura</SelectItem>
                    <SelectItem value="air_quality">Qualidade do Ar</SelectItem>
                    <SelectItem value="precipitation">Precipitação</SelectItem>
                    <SelectItem value="land_use">Uso do Solo</SelectItem>
                    <SelectItem value="human_activity">Atividade Humana</SelectItem>
                  </SelectContent>
                </Select>
                {isEeLoading && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</div>}

                {eeTileUrl && (
                  <div className="space-y-3 pt-2">
                    <Label htmlFor="opacity-slider">Opacidade</Label>
                    <Slider id="opacity-slider" min={0} max={1} step={0.1} value={[layerOpacity]} onValueChange={(v) => setLayerOpacity(v[0])} />
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
          <Map center={position} zoom={zoom} onCameraChanged={handleCameraChange} mapId="DEMO_MAP_ID" className="h-full w-full" gestureHandling={'greedy'} zoomControl={true} fullscreenControl={false} streetViewControl={false} mapTypeControl={false}>
            {markerPosition && <AdvancedMarker position={markerPosition}><MapPin className="h-8 w-8 text-primary" /></AdvancedMarker>}
            {eeTileUrl && <EarthEngineLayer tileUrl={eeTileUrl} opacity={layerOpacity} />}
          </Map>
        </main>
      </div>
    </>
  );
}

function PlaceAutocomplete({ onPlaceSelect, inputRef }: { onPlaceSelect: (place: PlaceResult) => void; inputRef: React.RefObject<HTMLInputElement> }) {
  const places = useMapsLibrary('places');

  useEffect(() => {
    if (!places || !inputRef.current) return;
    const ac = new places.Autocomplete(inputRef.current, { fields: ["place_id", "geometry", "name", "formatted_address"] });
    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (place.geometry) onPlaceSelect(place);
    });
    return () => listener.remove();
  }, [places, inputRef, onPlaceSelect]);

  return <div className="relative"><Input ref={inputRef} placeholder="Pesquisar um endereço" /></div>;
}

function EarthEngineLayer({ tileUrl, opacity }: { tileUrl: string, opacity: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const eeMapType = new google.maps.ImageMapType({ getTileUrl: (coord, zoom) => tileUrl.replace('{x}', String(coord.x)).replace('{y}', String(coord.y)).replace('{z}', String(zoom)), tileSize: new google.maps.Size(256, 256), name: 'EarthEngineLayer', maxZoom: 18, opacity: opacity });
    map.overlayMapTypes.push(eeMapType);
    return () => {
      const idx = map.overlayMapTypes.getArray().indexOf(eeMapType);
      if (idx > -1) map.overlayMapTypes.removeAt(idx);
    };
  }, [map, tileUrl, opacity]);
  return null;
}
