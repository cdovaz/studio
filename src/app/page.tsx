import { getLocations } from '@/app/actions';
import GeoSearchPage from '@/components/geosearch-page';

export default async function Home() {
  const locations = await getLocations();
  
  return (
    <GeoSearchPage initialLocations={locations} />
  );
}
