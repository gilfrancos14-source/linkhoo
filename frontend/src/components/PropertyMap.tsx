import { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

const markerIcon = new L.Icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// MapContainer est immuable après montage : on recentre via useMap
function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
}

interface PropertyMapProps {
  lat: number;
  lng: number;
  mapsUrl?: string | null;
  height?: number;
  interactive?: boolean;
  zoom?: number;
  showMarker?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}

export default function PropertyMap({
  lat,
  lng,
  mapsUrl,
  height = 250,
  interactive = false,
  zoom = 17,
  showMarker = true,
  onMapClick,
}: PropertyMapProps) {
  const googleUrl =
    mapsUrl ||
    `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="property-map" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        attributionControl
        style={{ height: '100%', width: '100%' }}
        {...(onMapClick
          ? {
              eventHandlers: {
                click: (e: { latlng: { lat: number; lng: number } }) => {
                  onMapClick(e.latlng.lat, e.latlng.lng);
                },
              },
            }
          : {})}
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Plan">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        {showMarker && (
          <Marker position={[lat, lng]} icon={markerIcon} interactive={interactive}>
            {interactive && (
              <Popup>
                <a href={googleUrl} target="_blank" rel="noopener noreferrer">
                  Ouvrir dans Google Maps
                </a>
              </Popup>
            )}
          </Marker>
        )}
        {onMapClick && <Recenter lat={lat} lng={lng} zoom={zoom} />}
      </MapContainer>
    </div>
  );
}
