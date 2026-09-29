import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PropertyMap from './PropertyMap';

type LatLng = { lat: number; lng: number };
type MapClickHandler = (e: { latlng: LatLng }) => void;

const mapState = vi.hoisted(() => ({
  setView: vi.fn<(view: [number, number], zoom: number) => void>(),
  eventHandlers: null as null | { click: MapClickHandler },
}));

vi.mock('react-leaflet', () => {
  type MapContainerProps = {
    center?: [number, number];
    zoom?: number;
    dragging?: boolean;
    eventHandlers?: { click: MapClickHandler };
    children?: ReactNode;
  };

  function MapContainer({
    center,
    zoom,
    dragging,
    eventHandlers,
    children,
  }: MapContainerProps) {
    mapState.eventHandlers = eventHandlers ?? null;
    return (
      <div
        data-testid="map-container"
        data-center={center ? `${center[0]},${center[1]}` : ''}
        data-zoom={zoom ?? ''}
        data-dragging={String(Boolean(dragging))}
      >
        {children}
      </div>
    );
  }

  function TileLayer({ url }: { url?: string }) {
    return <div data-testid="tile-layer" data-url={url ?? ''} />;
  }

  function Marker({
    position,
    children,
  }: {
    position?: [number, number];
    children?: ReactNode;
  }) {
    return (
      <div
        data-testid="marker"
        data-position={position ? `${position[0]},${position[1]}` : ''}
      >
        {children}
      </div>
    );
  }

  function Popup({ children }: { children?: ReactNode }) {
    return <div data-testid="popup">{children}</div>;
  }

  function BaseLayer({
    name,
    children,
  }: {
    name?: string;
    checked?: boolean;
    children?: ReactNode;
  }) {
    return (
      <div data-testid="base-layer" data-name={name ?? ''}>
        {children}
      </div>
    );
  }

  function LayersControl({ children }: { children?: ReactNode }) {
    return <div data-testid="layers-control">{children}</div>;
  }
  Object.assign(LayersControl, { BaseLayer });

  function useMap() {
    return { setView: mapState.setView };
  }

  return { MapContainer, TileLayer, Marker, Popup, LayersControl, useMap };
});

const baseProps = { lat: 5.324, lng: -4.012 };

beforeEach(() => {
  vi.clearAllMocks();
  mapState.eventHandlers = null;
});

afterEach(() => {
  cleanup();
});

describe('PropertyMap', () => {
  it('centre la carte sur les coordonnées fournies avec le zoom par défaut', () => {
    render(<PropertyMap {...baseProps} />);

    const map = screen.getByTestId('map-container');
    expect(map).toHaveAttribute('data-center', '5.324,-4.012');
    expect(map).toHaveAttribute('data-zoom', '17');
  });

  it('respecte les props height et zoom', () => {
    const { container } = render(<PropertyMap {...baseProps} height={300} zoom={12} />);

    const wrapper = container.querySelector<HTMLElement>('.property-map');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.style.height).toBe('300px');
    expect(screen.getByTestId('map-container')).toHaveAttribute('data-zoom', '12');
  });

  it('est non interactif par défaut', () => {
    render(<PropertyMap {...baseProps} />);

    expect(screen.getByTestId('map-container')).toHaveAttribute(
      'data-dragging',
      'false',
    );
  });

  it('active les interactions quand interactive vaut true', () => {
    render(<PropertyMap {...baseProps} interactive />);

    expect(screen.getByTestId('map-container')).toHaveAttribute(
      'data-dragging',
      'true',
    );
  });

  it('affiche un marqueur positionné par défaut', () => {
    render(<PropertyMap {...baseProps} />);

    expect(screen.getByTestId('marker')).toHaveAttribute(
      'data-position',
      '5.324,-4.012',
    );
  });

  it('n’affiche aucun marqueur avec showMarker=false', () => {
    render(<PropertyMap {...baseProps} showMarker={false} />);

    expect(screen.queryByTestId('marker')).toBeNull();
  });

  it('affiche le lien Google Maps (mapsUrl fourni) quand la carte est interactive', () => {
    render(
      <PropertyMap
        {...baseProps}
        interactive
        mapsUrl="https://maps.example.com/abc"
      />,
    );

    const link = screen.getByRole('link', { name: 'Ouvrir dans Google Maps' });
    expect(link).toHaveAttribute('href', 'https://maps.example.com/abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('construit l’URL Google Maps par défaut sans mapsUrl', () => {
    render(<PropertyMap {...baseProps} interactive />);

    expect(
      screen.getByRole('link', { name: 'Ouvrir dans Google Maps' }),
    ).toHaveAttribute('href', 'https://www.google.com/maps?q=5.324,-4.012');
  });

  it('n’affiche pas de popup quand la carte est non interactive', () => {
    render(<PropertyMap {...baseProps} mapsUrl="https://maps.example.com/abc" />);

    expect(screen.queryByTestId('popup')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('rend les deux couches de fond (Plan puis Satellite)', () => {
    render(<PropertyMap {...baseProps} />);

    const layers = screen.getAllByTestId('base-layer');
    expect(layers).toHaveLength(2);
    expect(layers[0]).toHaveAttribute('data-name', 'Plan');
    expect(layers[1]).toHaveAttribute('data-name', 'Satellite');

    const tiles = screen.getAllByTestId('tile-layer');
    expect(tiles).toHaveLength(2);
    expect(tiles[0].getAttribute('data-url')).toContain('tile.openstreetmap.org');
    expect(tiles[1].getAttribute('data-url')).toContain('arcgisonline.com');
  });

  it('transmet les clics de carte à onMapClick et recenter la vue', () => {
    const onMapClick = vi.fn();
    render(<PropertyMap {...baseProps} zoom={15} onMapClick={onMapClick} />);

    // Recenter (montage) recentre sur les coordonnées.
    expect(mapState.setView).toHaveBeenCalledWith([5.324, -4.012], 15);

    expect(mapState.eventHandlers).not.toBeNull();
    mapState.eventHandlers!.click({ latlng: { lat: 6.15, lng: 1.23 } });

    expect(onMapClick).toHaveBeenCalledTimes(1);
    expect(onMapClick).toHaveBeenCalledWith(6.15, 1.23);
  });

  it('n’installe aucun gestionnaire de clic sans onMapClick', () => {
    render(<PropertyMap {...baseProps} />);

    expect(mapState.eventHandlers).toBeNull();
    expect(mapState.setView).not.toHaveBeenCalled();
  });
});
