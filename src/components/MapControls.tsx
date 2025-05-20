import { FaLocationArrow } from 'react-icons/fa';

interface MapControlsProps {
  onGetCurrentLocation: () => void;
}

export const MapControls = ({ onGetCurrentLocation }: MapControlsProps) => {
  return (
    <div className='absolute bottom-4 right-4 flex flex-col gap-2 z-50'>
      <button
        onClick={onGetCurrentLocation}
        className='bg-white p-3 rounded-full shadow-lg hover:bg-gray-100'
      >
        <FaLocationArrow className="w-6 h-6 text-blue-500" />
      </button>
    </div>
  );
}; 