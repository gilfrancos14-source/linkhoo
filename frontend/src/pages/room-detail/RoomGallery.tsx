import type { Room } from '../../data/rooms';

interface RoomGalleryProps {
  room: Room;
  activeImg: number;
  onSelect: (index: number) => void;
}

export default function RoomGallery({ room, activeImg, onSelect }: RoomGalleryProps) {
  return (
    <div className="room-detail__gallery">
      <div className="room-detail__main-img">
        {room.images.length > 0 ? (
          <>
            <img src={room.images[activeImg]} alt={`${room.title} — photo ${activeImg + 1} sur ${room.images.length}`} />
            <span className="room-detail__img-counter" aria-live="polite" aria-atomic="true">
              Photo {activeImg + 1} sur {room.images.length}
            </span>
            <button type="button" className="room-detail__img-arrow room-detail__img-arrow--prev" aria-label="Photo précédente" onClick={() => onSelect(activeImg > 0 ? activeImg - 1 : room.images.length - 1)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button type="button" className="room-detail__img-arrow room-detail__img-arrow--next" aria-label="Photo suivante" onClick={() => onSelect(activeImg < room.images.length - 1 ? activeImg + 1 : 0)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '14px' }}>
            Aucune photo disponible
          </div>
        )}
      </div>
      <div className="room-detail__thumbs">
        {room.images.map((img, i) => (
          <button
            key={i}
            type="button"
            className={`room-detail__thumb${i === activeImg ? ' is-active' : ''}`}
            onClick={() => onSelect(i)}
            aria-label={`Voir la photo ${i + 1}`}
          >
            <img src={img} alt={`${room.title} — aperçu ${i + 1}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
