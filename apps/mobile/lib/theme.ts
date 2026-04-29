import { useColorScheme } from 'nativewind';

export function useResolvedColorScheme(): 'light' | 'dark' {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? 'dark' : 'light';
}

const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
const MAP_STYLE_DARK  = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export function useMapStyleUrl(): string {
  return useResolvedColorScheme() === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
}
