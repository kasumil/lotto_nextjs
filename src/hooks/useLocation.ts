import { useEffect, useState } from 'react';

export const useLocation = () => {
  const [location, setLocation] = useState({ lat: 37.5665, lng: 126.9780 });

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async(position) => {
        await setLocation({ 
          lat: position.coords.latitude, 
          lng: position.coords.longitude
        });
      });
    }
  }, []);

  return location;
}; 