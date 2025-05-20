interface MapErrorProps {
  message?: string;
  subMessage?: string;
}

export const MapError = ({ 
  message = "일일 요청 한도 초과", 
  subMessage = "잠시 후 다시 시도해 주세요." 
}: MapErrorProps) => {
  return (
    <div className='w-full h-full flex items-center justify-center bg-gray-100'>
      <div className='text-center p-6 bg-white rounded-lg shadow-lg'>
        <h2 className='text-xl font-bold text-red-600 mb-2'>{message}</h2>
        <p className='text-gray-600'>죄송합니다. 현재 지도 서비스의 일일 요청 한도를 초과했습니다.</p>
        <p className='text-gray-600 mt-2'>{subMessage}</p>
      </div>
    </div>
  );
}; 