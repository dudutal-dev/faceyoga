import { useEffect, useState } from 'react';
import { onUpdate, updateNow } from '../pwa';
export default function UpdateBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => onUpdate(setShow), []);
  if (!show) return null;
  return (
    <div role="status" className="fixed top-2 inset-x-3 z-50 card p-3 flex items-center justify-between gap-3 shadow-lg" style={{ marginTop: 'env(safe-area-inset-top)' }}>
      <span className="font-semibold">גרסה חדשה מוכנה</span><button className="chip !min-h-10" onClick={() => updateNow()}>רענון</button>
    </div>
  );
}
