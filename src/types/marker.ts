export interface MarkerStyle {
  width: string;
  height: string;
  background: string;
  borderRadius: string;
  color: string;
  textAlign: string;
  fontWeight: string;
  lineHeight: string;
}

export const MARKER_STYLES: MarkerStyle[] = [
  {
    width: '30px',
    height: '30px',
    background: 'rgba(255, 0, 0, 0.8)',
    borderRadius: '50%',
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    lineHeight: '30px'
  },
  {
    width: '40px',
    height: '40px',
    background: 'rgba(255, 0, 0, 0.8)',
    borderRadius: '50%',
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    lineHeight: '40px'
  },
  {
    width: '50px',
    height: '50px',
    background: 'rgba(255, 0, 0, 0.8)',
    borderRadius: '50%',
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    lineHeight: '50px'
  }
];

export const MARKER_IMAGE = {
  src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
  size: { width: 24, height: 35 }
}; 