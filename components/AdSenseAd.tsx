import React, { useEffect } from 'react';

interface AdSenseAdProps {
  adSlot: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
  style?: React.CSSProperties;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

const AdSenseAd: React.FC<AdSenseAdProps> = ({
  adSlot,
  adFormat = 'auto',
  fullWidthResponsive = true,
  style = { display: 'block' },
}) => {
  useEffect(() => {
    try {
      if (window.adsbygoogle && process.env.NODE_ENV === 'production') {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      }
    } catch (error) {
      console.error('AdSense error:', error);
    }
  }, []);

  // Don't show ads in development
  if (process.env.NODE_ENV !== 'production') {
    return (
      <div className="bg-slate-700 border-2 border-dashed border-slate-600 p-8 text-center rounded-lg">
        <p className="text-slate-400 text-sm">Ad Placeholder (Development Mode)</p>
        <p className="text-slate-500 text-xs mt-2">AdSense ad will appear here in production</p>
      </div>
    );
  }

  return (
    <ins
      className="adsbygoogle"
      style={style}
      data-ad-client={import.meta.env.VITE_ADSENSE_CLIENT_ID}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive={fullWidthResponsive.toString()}
    />
  );
};

export default AdSenseAd;
