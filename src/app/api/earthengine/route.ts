import { NextRequest, NextResponse } from 'next/server';
import ee from '@google/earthengine';
import { authenticate } from '@/lib/ee';

// Definindo os tipos de camada para segurança e clareza
type LayerType = 'temperature' | 'air_quality' | 'precipitation' | 'land_use' | 'human_activity';

// Função para obter o período de data mais recente (últimos 30 dias)
const getRecentDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    return { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] };
};

// Objeto para configurar cada camada de dados
const layers = {
    temperature: () => {
        const { start, end } = getRecentDateRange();
        return {
            image: new ee.ImageCollection('MODIS/061/MOD11A1')
                     .filter(ee.Filter.date(start, end))
                     .select('LST_Day_1km')
                     .mean(),
            visParams: {
                min: 13000.0, max: 16500.0,
                palette: ['040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6', '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef', '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f', 'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d', 'ff0000', 'de0101', 'c21301', 'a71001', '911001']
            }
        };
    },
    air_quality: () => {
        const { start, end } = getRecentDateRange();
        return {
            image: new ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2')
                     .filter(ee.Filter.date(start, end))
                     .select('tropospheric_NO2_column_number_density')
                     .mean(),
            visParams: {
                min: 0, max: 0.0002,
                palette: ['black', 'blue', 'purple', 'cyan', 'green', 'yellow', 'red']
            }
        };
    },
    precipitation: () => {
        const { start, end } = getRecentDateRange();
        return {
            image: new ee.ImageCollection('NASA/GPM_L3/IMERG_V06')
                     .filter(ee.Filter.date(start, end))
                     .select('precipitationCal')
                     .mean(),
            visParams: {
                min: 0.1, max: 10,
                palette: ['#FFFFFF', '#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF0000']
            }
        };
    },
    land_use: () => {
        return {
            // Usando uma imagem estática para uso do solo, pois não muda com frequência.
            image: new ee.Image('MODIS/051/MCD12Q1/2001_01_01').select('Land_Cover_Type_1'),
            visParams: {
                min: 1.0, max: 17.0,
                palette: ['#aec3d4','#152106','#225129','#369b47','#30eb5b','#387242','#6a2325','#c3aa69','#b76031','#d9903d','#91af40','#111149','#cdb33b','#cc0013','#33280d','#d7cdcc','#f7e084','#6f6f6f']
            }
        };
    },
    human_activity: () => {
        return {
            // Luzes noturnas como um proxy para atividade humana.
            image: new ee.ImageCollection('NOAA/DMSP-OLS/NIGHTTIME_LIGHTS')
                     .filter(ee.Filter.date('2013-01-01', '2014-01-01')) // Usando o último ano completo disponível
                     .select('stable_lights')
                     .mean(),
            visParams: { min: 3.0, max: 63.0, palette: ['#000000', '#FFFF00', '#FF0000', '#FFFFFF'] }
        };
    }
};

// Função auxiliar para converter o callback do Earth Engine em uma Promise
function getMapIdPromise(image: ee.Image, visParams: object): Promise<{ urlFormat: string }> {
    return new Promise((resolve, reject) => {
        // CORREÇÃO: Usar image.getMapId() que retorna um URL de tile, não image.getMap().
        image.getMapId(visParams, (data: { urlFormat: string; }, error: string) => {
            if (error) {
                return reject(new Error(error));
            }
            if (data && data.urlFormat) {
                resolve(data);
            } else {
                reject(new Error("A API getMapId não retornou dados válidos."));
            }
        });
    });
}

export async function GET(req: NextRequest) {
    try {
        await authenticate(); // Garante que o GEE está autenticado

        const { searchParams } = new URL(req.url);
        const layerType = searchParams.get('layer') as LayerType | null;

        if (!layerType || !layers[layerType]) {
            return NextResponse.json({ error: 'Invalid layer specified' }, { status: 400 });
        }

        const layerConfig = layers[layerType]();
        const mapData = await getMapIdPromise(layerConfig.image, layerConfig.visParams);
        
        return NextResponse.json(mapData);

    } catch (error) {
        console.error('Error generating Earth Engine tiles:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: 'Failed to generate map tiles.', details: errorMessage }, { status: 500 });
    }
}
