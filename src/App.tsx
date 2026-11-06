import { useMemo } from 'react';
import DesktopApp from './desktop/DesktopApp';
import PhoneApp from './phone/PhoneApp';

export default function App() {
  const view = useMemo(() => new URLSearchParams(window.location.search).get('view'), []);
  return view === 'phone' ? <PhoneApp /> : <DesktopApp />;
}
