import dagger1 from './assets/equipment/dagger-1.png';
import dagger2 from './assets/equipment/dagger-2.png';
import dagger3 from './assets/equipment/dagger-3.png';
import shield1 from './assets/equipment/shield-1.png';
import shield2 from './assets/equipment/shield-2.png';
import shield3 from './assets/equipment/shield-3.png';
import shoes1 from './assets/equipment/shoes-1.png';
import shoes2 from './assets/equipment/shoes-2.png';
import shoes3 from './assets/equipment/shoes-3.png';

const equipmentArtwork = {
  'shoes-1': shoes1, 'shoes-2': shoes2, 'shoes-3': shoes3,
  'dagger-1': dagger1, 'dagger-2': dagger2, 'dagger-3': dagger3,
  'shield-1': shield1, 'shield-2': shield2, 'shield-3': shield3,
} as const;

export function artworkFor(key: string): string | undefined {
  return equipmentArtwork[key as keyof typeof equipmentArtwork];
}
